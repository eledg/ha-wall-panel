import { describe, expect, it, vi } from 'vitest';

import { startWebRtc, type WebRtcConnection } from './webrtc.ts';

const CAMERA = 'camera.front_door';

/** The parts of RTCPeerConnection that `startWebRtc` uses, recorded. */
class FakePeer {
  config: RTCConfiguration;
  transceivers: [string, RTCRtpTransceiverInit | undefined][] = [];
  remote?: RTCSessionDescriptionInit;
  added: RTCIceCandidateInit[] = [];
  closed = false;
  connectionState = 'new';
  ontrack?: (e: { streams: unknown[]; track: unknown }) => void;
  onicecandidate?: (e: { candidate: { toJSON: () => unknown } | null }) => void;
  onconnectionstatechange?: () => void;

  constructor(config: RTCConfiguration) {
    this.config = config;
  }
  addTransceiver(kind: string, init?: RTCRtpTransceiverInit) {
    this.transceivers.push([kind, init]);
  }
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'v=0 offer' });
  }
  setLocalDescription() {
    return Promise.resolve();
  }
  setRemoteDescription(desc: RTCSessionDescriptionInit) {
    this.remote = desc;
    return Promise.resolve();
  }
  addIceCandidate(candidate: RTCIceCandidateInit) {
    this.added.push(candidate);
    return Promise.resolve();
  }
  close() {
    this.closed = true;
  }
  /** Gathers a local candidate. */
  gather(candidate: string) {
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate }) } });
  }
}

/** A fake HA connection that answers the camera messages like HA 2026.11. */
const setup = (streamTypes = ['hls', 'web_rtc']) => {
  const sent: Record<string, unknown>[] = [];
  let push: ((msg: unknown) => void) | undefined;
  const unsubscribe = vi.fn(() => Promise.resolve());
  const conn = {
    sendMessagePromise: (msg: Record<string, unknown>) => {
      sent.push(msg);
      if (msg.type === 'camera/capabilities')
        return Promise.resolve({ frontend_stream_types: streamTypes });
      if (msg.type === 'camera/webrtc/get_client_config')
        return Promise.resolve({
          configuration: { iceServers: [{ urls: ['stun:example:3478'] }] },
        });
      return Promise.resolve(null);
    },
    subscribeMessage: (cb: (msg: unknown) => void, msg: unknown) => {
      sent.push(msg as Record<string, unknown>);
      push = cb;
      return Promise.resolve(unsubscribe);
    },
  } as unknown as WebRtcConnection;
  let peer: FakePeer | undefined;
  const onStream = vi.fn();
  const onFail = vi.fn();
  const session = startWebRtc(conn, CAMERA, { onStream, onFail }, (config) => {
    peer = new FakePeer(config);
    return peer as unknown as RTCPeerConnection;
  });
  return {
    session,
    sent,
    onStream,
    onFail,
    unsubscribe,
    peer: () => peer!,
    push: (msg: unknown) => push!(msg),
    settle: () => new Promise((r) => setTimeout(r, 0)),
  };
};

describe('startWebRtc', () => {
  it('offers receive-only video and applies the answer', async () => {
    const t = setup();
    await t.settle();

    expect(t.peer().config).toEqual({
      iceServers: [{ urls: ['stun:example:3478'] }],
    });
    expect(t.peer().transceivers).toEqual([
      ['video', { direction: 'recvonly' }],
    ]);
    expect(t.sent.at(-1)).toEqual({
      type: 'camera/webrtc/offer',
      entity_id: CAMERA,
      offer: 'v=0 offer',
    });

    t.push({ type: 'session', session_id: 's1' });
    t.push({ type: 'answer', answer: 'v=0 answer' });
    await t.settle();
    expect(t.peer().remote).toEqual({ type: 'answer', sdp: 'v=0 answer' });

    const stream = {};
    t.peer().ontrack?.({ streams: [stream], track: {} });
    expect(t.onStream).toHaveBeenCalledWith(stream);
    expect(t.onFail).not.toHaveBeenCalled();
  });

  it('holds local candidates until HA names the session', async () => {
    const t = setup();
    await t.settle();
    t.peer().gather('early');
    expect(t.sent.some((m) => m.type === 'camera/webrtc/candidate')).toBe(
      false,
    );

    t.push({ type: 'session', session_id: 's1' });
    t.peer().gather('late');

    expect(t.sent.filter((m) => m.type === 'camera/webrtc/candidate')).toEqual(
      ['early', 'late'].map((candidate) => ({
        type: 'camera/webrtc/candidate',
        entity_id: CAMERA,
        session_id: 's1',
        candidate: { candidate },
      })),
    );
  });

  it("holds HA's candidates until the answer is applied", async () => {
    const t = setup();
    await t.settle();
    t.push({ type: 'session', session_id: 's1' });
    t.push({ type: 'candidate', candidate: { candidate: 'remote' } });
    expect(t.peer().added).toEqual([]);

    t.push({ type: 'answer', answer: 'v=0 answer' });
    await t.settle();
    expect(t.peer().added).toEqual([{ candidate: 'remote' }]);
  });

  it('fails without offering when the camera has no WebRTC', async () => {
    const t = setup(['hls']);
    await t.settle();

    expect(t.onFail).toHaveBeenCalledWith('WebRTC unsupported');
    expect(t.sent.map((m) => m.type)).toEqual(['camera/capabilities']);
  });

  it('fails and closes on an error from HA', async () => {
    const t = setup();
    await t.settle();
    t.push({ type: 'session', session_id: 's1' });
    t.push({
      type: 'error',
      code: 'go2rtc_webrtc_offer_failed',
      message: 'webrtc: streams: unknown error',
    });

    expect(t.onFail).toHaveBeenCalledTimes(1);
    expect(t.onFail).toHaveBeenCalledWith('webrtc: streams: unknown error');
    expect(t.peer().closed).toBe(true);
    expect(t.unsubscribe).toHaveBeenCalled();
  });

  it('fails when the peer connection fails', async () => {
    const t = setup();
    await t.settle();
    t.peer().connectionState = 'failed';
    t.peer().onconnectionstatechange?.();

    expect(t.onFail).toHaveBeenCalledWith('WebRTC connection failed');
  });

  it('closes the peer and the subscription, and reports nothing after', async () => {
    const t = setup();
    await t.settle();
    t.session.close();
    t.push({ type: 'error', code: 'x', message: 'late' });

    expect(t.peer().closed).toBe(true);
    expect(t.unsubscribe).toHaveBeenCalled();
    expect(t.onFail).not.toHaveBeenCalled();
  });

  it('never makes a peer when closed during signalling', async () => {
    const t = setup();
    t.session.close();
    await t.settle();

    expect(t.peer()).toBeUndefined();
    expect(t.onFail).not.toHaveBeenCalled();
  });
});
