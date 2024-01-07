const FPS = 24;
const FFT_SIZE = 512;
const VIEW_HEIGHT = 1000;
const VIEW_WIDTH = 1000;
const FREQS_PER_FRAME = 150; // cut off upper range frequencies, 255 max

let audioCtx, audioOff, analyser, canvas, canvasCtx;
let sampleRate;
let playButton, stopButton, audioElem;
let spectrumData;
let intervalId;
let songSrc;

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

  songSrc = "./tunes/follies.mp3";

  loadAudio(songSrc);
}

function loadAudio(url) {
  audioElem.src = url;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  fetch(url)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
    .then(getAudioData);
}

async function playAudio() {
  // audio
  audioElem.play();
  //   audioElem.muted = true;

  audioElem.addEventListener("play", renderAudioVisuals);
  audioElem.addEventListener("ended", stopAudio);
}

function renderAudioVisuals() {
  // render
  clearCanvas();

  const RENDER_RATE = 1000 / FPS;

  let i = 0;
  intervalId = setInterval(() => {
    const frame = spectrumData[i];
    if (frame) {
      renderFrame(frame, i);
      i++;
    }
  }, RENDER_RATE);
}

async function stopAudio() {
  clearInterval(intervalId);
  // audio
  audioElem.load();
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
        console.log("Audio-Spectrum Decoded!");
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

function renderFrame(frame, frameIndex) {
  clearCanvas();
  let i = 0;
  // get rid of frequencies not in mix
  // up to about 20khz or so
  let croppedFrequencies = frame.slice(0, FREQS_PER_FRAME);
  for (const frequency of croppedFrequencies) {
    drawFrequency(frequency, i, frameIndex);
    i++;
  }
}

function drawFrequency(db, index, frameIndex) {
  drawFrequencyCurrent(db, index, frameIndex);
  drawFrequencySoFar(index, frameIndex);
}

function drawFrequencyCurrent(db, index, frameIndex) {
  db = normaliseDbForRender(db);
  const frameDegOffset = (frameIndex + 360) % 360;
  const from = [VIEW_WIDTH / 2, VIEW_HEIGHT / 2];
  const angleDeg = (index / FREQS_PER_FRAME) * 360 + frameDegOffset;
  const angleRad = (angleDeg / 180) * Math.PI;

  const basePosition = [from[0] + db, from[1]];
  const rotatedPosition = rotate(basePosition, from, angleRad);

  drawLine(from, rotatedPosition, "gray");
}

function drawFrequencySoFar(frequencyIndex, frameIndex) {
  //   drawLine(from, rotatedPosition, getColorFromFrequency(frequencyIndex));
}

function normaliseDbForRender(db) {
  if (db < 30) {
    return db * 3;
  }
  if (db < 60) {
    return db * 2;
  }
  if (db < 120) {
    return db * 1.5;
  }
  return db;
}

// draw helpers

function getColorFromFrequency(fIndex) {
  const color = `rgb(${fIndex}, ${fIndex}, ${fIndex})`;
  return color;
}

function getRandomColor() {
  const color = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${
    Math.random() * 255
  })`;
  return color;
}

function drawLine(from, to, color) {
  canvasCtx.strokeStyle = color;
  canvasCtx.beginPath();
  canvasCtx.moveTo(from[0], from[1]);
  canvasCtx.lineTo(to[0], to[1]);
  canvasCtx.stroke();
}

// math helpers

function rotate(position, center, angle) {
  const at0 = subtract(position, center);
  const rotatedAt0 = [
    at0[0] * Math.cos(angle) - at0[1] * Math.sin(angle),
    at0[1] * Math.cos(angle) + at0[0] * Math.sin(angle),
  ];

  const rotated = add(rotatedAt0, center);

  return rotated;
}

function add(v1, v2) {
  return [v1[0] + v2[0], v1[1] + v2[1]];
}

function subtract(v1, v2) {
  return [v1[0] - v2[0], v1[1] - v2[1]];
}
