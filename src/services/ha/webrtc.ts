import type { Connection } from 'home-assistant-js-websocket';

/** The two calls WebRTC signalling needs from the HA connection. */
export type WebRtcConnection = Pick<
  Connection,
  'sendMessagePromise' | 'subscribeMessage'
>;

export type WebRtcHandlers = {
  /** The remote video, once a track arrives. It may not have a frame yet. */
  onStream: (stream: MediaStream) => void;
  /** Called at most once: unsupported, refused by HA or go2rtc, or the connection failed. */
  onFail: (reason: string) => void;
};

export type WebRtcSession = { close: () => void };

/** The messages HA sends on a `camera/webrtc/offer` subscription. */
type OfferMessage =
  | { type: 'session'; session_id: string }
  | { type: 'answer'; answer: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }
  | { type: 'error'; code: string; message: string };

const errorText = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err && 'message' in err)
    return String(err.message);
  return String(err);
};

/**
 * Receives a camera over WebRTC, with HA brokering the signalling over the
 * WebSocket (see docs/doorbell.md#webrtc): `camera/capabilities`,
 * `camera/webrtc/get_client_config`, then a `camera/webrtc/offer` subscription
 * that answers with a session, the answer and candidates; local candidates go
 * back with `camera/webrtc/candidate`. Receive-only video: no audio, so no
 * microphone prompt. The caller decides how long to wait for a frame.
 */
export const startWebRtc = (
  conn: WebRtcConnection,
  camera: string,
  { onStream, onFail }: WebRtcHandlers,
  createPeer = (config: RTCConfiguration) => new RTCPeerConnection(config),
): WebRtcSession => {
  let closed = false;
  let peer: RTCPeerConnection | undefined;
  let unsubscribe: (() => Promise<void>) | undefined;

  const close = () => {
    if (closed) return;
    closed = true;
    unsubscribe?.().catch(() => {});
    peer?.close();
  };
  const fail = (reason: string) => {
    if (closed) return;
    close();
    onFail(reason);
  };

  const run = async () => {
    const caps = await conn.sendMessagePromise<{
      frontend_stream_types?: string[];
    }>({ type: 'camera/capabilities', entity_id: camera });
    if (!caps.frontend_stream_types?.includes('web_rtc'))
      return fail('WebRTC unsupported');
    const client = await conn.sendMessagePromise<{
      configuration?: RTCConfiguration;
    }>({ type: 'camera/webrtc/get_client_config', entity_id: camera });
    if (closed) return;

    const pc = createPeer(client.configuration ?? {});
    peer = pc;
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.ontrack = (e) => onStream(e.streams[0] ?? new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') fail('WebRTC connection failed');
    };

    // Candidates found before HA names the session wait for it.
    let session: string | undefined;
    const pending: RTCIceCandidateInit[] = [];
    const sendCandidate = (candidate: RTCIceCandidateInit) => {
      conn
        .sendMessagePromise({
          type: 'camera/webrtc/candidate',
          entity_id: camera,
          session_id: session,
          candidate,
        })
        .catch(() => {});
    };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const candidate = e.candidate.toJSON();
      if (session) sendCandidate(candidate);
      else pending.push(candidate);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (closed) return;

    // HA's candidates can arrive before the answer is applied; they wait for it.
    let answered = false;
    const remote: RTCIceCandidateInit[] = [];
    const addCandidate = (candidate: RTCIceCandidateInit) => {
      pc.addIceCandidate(candidate).catch(() => {});
    };
    const onMessage = (msg: OfferMessage) => {
      if (closed) return;
      if (msg.type === 'session') {
        session = msg.session_id;
        pending.splice(0).forEach(sendCandidate);
      } else if (msg.type === 'answer') {
        pc.setRemoteDescription({ type: 'answer', sdp: msg.answer })
          .then(() => {
            answered = true;
            remote.splice(0).forEach(addCandidate);
          })
          .catch((err: unknown) => fail(errorText(err)));
      } else if (msg.type === 'candidate') {
        if (answered) addCandidate(msg.candidate);
        else remote.push(msg.candidate);
      } else if (msg.type === 'error') {
        fail(msg.message);
      }
    };
    const unsub = await conn.subscribeMessage<OfferMessage>(onMessage, {
      type: 'camera/webrtc/offer',
      entity_id: camera,
      offer: offer.sdp,
    });
    if (closed) unsub().catch(() => {});
    else unsubscribe = unsub;
  };
  run().catch((err: unknown) => fail(errorText(err)));

  return { close };
};
