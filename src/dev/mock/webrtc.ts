/**
 * How the mock's camera answers WebRTC: `ok` streams, `unsupported` lacks
 * `web_rtc` in its capabilities, `rejected` refuses the offer as go2rtc does
 * when it cannot reach the camera, and `silent` never answers, so the panel's
 * first-frame timeout fires.
 */
export type MockWebRtc = 'ok' | 'unsupported' | 'rejected' | 'silent';

/** The modes for the mock's door panel. */
export const MOCK_WEBRTC: { id: MockWebRtc; label: string }[] = [
  { id: 'ok', label: 'WebRTC works' },
  { id: 'unsupported', label: 'WebRTC unsupported' },
  { id: 'rejected', label: 'WebRTC rejected' },
  { id: 'silent', label: 'WebRTC no answer' },
];

/** The error go2rtc gave a real HA for an offer it could not serve. */
export const OFFER_FAILED = {
  type: 'error',
  code: 'go2rtc_webrtc_offer_failed',
  message: 'webrtc: streams: unknown error',
};

export type MockPeer = {
  addCandidate: (candidate: RTCIceCandidateInit) => void;
  close: () => void;
};

/**
 * Stands in for go2rtc, in the page: a second peer connection that answers
 * the panel's offer with a canvas showing the mock's snapshot, labelled and
 * ticking so it is clear the video is live and came over WebRTC.
 */
export const mockGo2rtc = (
  offer: string,
  snapshotUrl: string,
  send: (msg: unknown) => void,
): MockPeer => {
  const pc = new RTCPeerConnection();
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = snapshotUrl;
  const draw = () => {
    if (!ctx) return;
    ctx.fillStyle = '#2a2f36';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (img.complete && img.naturalWidth > 0)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
    ctx.fillStyle = '#fff';
    ctx.font = '36px sans-serif';
    ctx.fillText(
      `Mock WebRTC ${new Date().toLocaleTimeString()}`,
      24,
      canvas.height - 28,
    );
  };
  draw();
  // A canvas stream only sends a frame when the canvas changes.
  const timer = setInterval(draw, 200);
  const stream = canvas.captureStream(5);

  pc.onicecandidate = (e) => {
    if (e.candidate)
      send({ type: 'candidate', candidate: e.candidate.toJSON() });
  };
  const answer = async () => {
    await pc.setRemoteDescription({ type: 'offer', sdp: offer });
    // After the offer, so the track takes the panel's receive-only transceiver.
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    const desc = await pc.createAnswer();
    await pc.setLocalDescription(desc);
    send({ type: 'answer', answer: desc.sdp });
  };
  const close = () => {
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    pc.close();
  };
  answer().catch((err: unknown) => {
    send({ ...OFFER_FAILED, message: String(err) });
    close();
  });

  return {
    addCandidate: (candidate) => {
      pc.addIceCandidate(candidate).catch(() => {});
    },
    close,
  };
};
