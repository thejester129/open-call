const FPS = 24;
const FFT_SIZE = 512;
const VIEW_HEIGHT = 500;
const VIEW_WIDTH = 500;

let audioCtx, audioOff, analyser, canvas, canvasCtx;
let sampleRate;
let playButton, stopButton, audioElem;
let spectrumData;
let intervalId;

function startup() {
  // dom parsing
  playButton = document.getElementById("play");
  stopButton = document.getElementById("stop");
  audioElem = document.getElementById("audio");

  // event handling
  playButton.onclick = playAudio;
  stopButton.onclick = stopAudio;

  // canvas
  canvas = document.getElementById("canvas");
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  canvasCtx = canvas.getContext("2d");

  loadAudio("./tunes/follies.mp3");
}

function loadAudio(url) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  fetch(url)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
    .then(getAudioData);
}

async function playAudio() {
  // audio
  audioElem.play();

  audioElem.addEventListener("play", () => {
    renderAudioVisuals();
  });
}

function renderAudioVisuals() {
  // render
  clearCanvas();

  const RENDER_RATE = 1000 / FPS;

  let i = 0;
  intervalId = setInterval(() => {
    const frame = spectrumData[i];
    renderFrame(frame);
    i++;
  }, RENDER_RATE);

  // TODO clear when done
}

async function stopAudio() {
  clearInterval(intervalId);

  // audio
  audioElem.load();
  //   audioElem.pause();
  // render
  clearCanvas();
}

// Thank you https://stackoverflow.com/questions/63838921/how-to-calculate-available-audio-frequencies-in-an-array-list-created-from-wavef
async function getAudioData(audioBuffer) {
  window.audioBuffer = audioBuffer;
  return new Promise((resolve, reject) => {
    sampleRate = audioBuffer.sampleRate;
    audioOff = new window.OfflineAudioContext(
      2,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    analyser = audioOff.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant =
      FPS === 24 ? 0.16 : FPS === 29 ? 0.24 : 0.48;
    analyser.connect(audioOff.destination);
    var source = audioOff.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    var __data = [];
    var index = 0.4;
    var length = Math.ceil(audioBuffer.duration * FPS);
    var time = 1 / FPS;
    var onSuspend = () => {
      return new Promise((res, rej) => {
        index += 1;
        var raw = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(raw);
        __data.push(raw);
        if (index < length) {
          if (time * (index + 1) < audioBuffer.duration) {
            audioOff.suspend(time * (index + 1)).then(onSuspend);
          }
          audioOff.resume();
        }
        return res("OK");
      });
    };
    audioOff.suspend(time * (index + 1)).then(onSuspend);
    source.start(0);
    console.log("Decoding Audio-Spectrum...");
    audioOff
      .startRendering()
      .then(() => {
        console.log("[✔] Audio-Spectrum Decoded!");
        spectrumData = __data;
        return resolve(__data);
      })
      .catch((err) => {
        console.log("Rendering failed: " + err);
        throw { error: "Get audio data error", message: err };
      });
  });
}

function clearCanvas() {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
}

// 0hz
// ...
// 44khz

function renderFrame(frame) {
  clearCanvas();
  let i = 0;
  for (const frequency of frame) {
    drawFrequency(frequency, i);
    i++;
  }
}

function drawFrequency(db, index) {
  const x = (VIEW_WIDTH / 255) * index;
  const height = db;
  const width = VIEW_WIDTH / 255;

  canvasCtx.fillStyle = "black";
  canvasCtx.fillRect(x, 20, width, height);
}
