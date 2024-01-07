const FPS = 24;
const FFT_SIZE = 512;
const VIEW_HEIGHT = 1000;
const VIEW_WIDTH = 1000;
const FREQS_PER_FRAME = 150; // cut off upper range frequencies, 255 max

// drawing consts
const MEMORY_LINE_FACTOR = 50;
const CURRENT_LINE_THICKNESS = 3;
const CURRENT_LINE_COLOR_RANGE = 150;
const CIRCLE_RADIUS_FACTOR = 40;
const CIRCLE_COLOR = "green";
const SPIN_BACKGROUND = false;

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

  audioElem.addEventListener("play", handleRenderAudioVisuals);
  audioElem.addEventListener("ended", stopAudio);
}

function handleRenderAudioVisuals() {
  setTimeout(renderAudioVisuals, 200); // hack to sync things up
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

function renderFrame(frame, frameIndex) {
  clearCanvas();
  let i = 0;
  // get rid of frequencies not in mix
  // up to about 20khz or so
  let croppedFrequencies = frame.slice(0, FREQS_PER_FRAME);
  for (const frequency of croppedFrequencies) {
    drawFrequency(frequency, i, frameIndex);
    drawBeatCircle(frameIndex);
    drawProgress(frameIndex);
    i++;
  }
}

function drawFrequency(db, index, frameIndex) {
  drawFrequencySoFar(index, frameIndex);
  drawFrequencyCurrent(db, index, frameIndex);
}

function drawFrequencyCurrent(db, freqIndex, frameIndex) {
  //   db = normaliseDbForRender(db);

  const frameDegOffset = (frameIndex + 360) % 360;
  const from = [VIEW_WIDTH / 2, VIEW_HEIGHT / 2];

  const angleRad = getAngleRadsForFrequency(freqIndex, frameDegOffset);

  const basePosition = [from[0] + db, from[1]];
  const rotatedPosition = rotate(basePosition, from, angleRad);

  drawLine(
    from,
    rotatedPosition,
    "black",
    // getRandomColor(CURRENT_LINE_COLOR_RANGE),
    CURRENT_LINE_THICKNESS
  );
}

function drawFrequencySoFar(freqIndex, frameIndex, canReset = false) {
  let lineLength = getTotalDbForFrequencySoFar(freqIndex, frameIndex);
  const max = VIEW_WIDTH * 2 + VIEW_WIDTH;
  while (lineLength > max && canReset) {
    // reset colors
    lineLength = lineLength - max;
  }

  // 1st
  drawMemoryLine(freqIndex, frameIndex, lineLength, "rgb(100, 100, 100)");

  if (lineLength > VIEW_WIDTH / 2) {
    // 2nd
    drawMemoryLine(
      freqIndex,
      frameIndex,
      lineLength - VIEW_WIDTH / 2,
      "rgb(0, 0, 0)"
    );
  }
  if (lineLength > VIEW_WIDTH) {
    // 3rd
    drawMemoryLine(
      freqIndex,
      frameIndex,
      lineLength - VIEW_WIDTH,
      "rgb(255, 0, 0)"
    );
  }
  if (lineLength > VIEW_WIDTH + VIEW_WIDTH / 2) {
    // 4th
    drawMemoryLine(
      freqIndex,
      frameIndex,
      lineLength - VIEW_WIDTH - VIEW_WIDTH / 2,
      "rgb(0, 255, 0)"
    );
  }
  if (lineLength > VIEW_WIDTH * 2) {
    // 5th
    drawMemoryLine(
      freqIndex,
      frameIndex,
      lineLength - VIEW_WIDTH * 2,
      "rgb(0, 0, 255)"
    );
  }

  if (!canReset) {
    drawFrequencySoFar(freqIndex, frameIndex, true); // overlay second
  }
}

function drawMemoryLine(freqIndex, frameIndex, length, color) {
  const from = [VIEW_WIDTH / 2, VIEW_HEIGHT / 2];
  let frameDegOffset = (frameIndex + 360) % 360;

  if (!SPIN_BACKGROUND) {
    frameDegOffset = 0;
  }

  const angleRad = getAngleRadsForFrequency(freqIndex, frameDegOffset);

  let basePosition = [from[0] + length, from[1]];
  let rotatedPosition = rotate(basePosition, from, angleRad);

  drawLine(from, rotatedPosition, color);
}

function drawBeatCircle(frameIndex) {
  const totalDb = spectrumData[frameIndex].reduce((a, b) => a + b, 0);
  const radius = totalDb / CIRCLE_RADIUS_FACTOR;

  drawCircle(radius, CIRCLE_COLOR);
}

function drawProgress(frameIndex) {
  const progress = frameIndex / spectrumData.length;
  const progressWidth = progress * VIEW_WIDTH;
  const progressHeight = progress * VIEW_HEIGHT;
  const color = "black";
  const width = 3;

  // top
  const fromTop = [0, 0];
  const toTop = [progressWidth, 0];
  drawLine(fromTop, toTop, color, width);

  // bottom
  const fromBottom = [VIEW_WIDTH, VIEW_HEIGHT];
  const toBottom = [VIEW_WIDTH - progressWidth, VIEW_HEIGHT];
  drawLine(fromBottom, toBottom, color, width);

  // left
  const fromLeft = [0, VIEW_HEIGHT];
  const toLeft = [0, VIEW_HEIGHT - progressHeight];
  drawLine(fromLeft, toLeft, color, width);

  // right
  const fromRight = [VIEW_WIDTH, 0];
  const toRight = [VIEW_WIDTH, progressHeight];
  drawLine(fromRight, toRight, color, width);
}

function getAngleRadsForFrequency(freqIndex, offset) {
  const angleDeg = (freqIndex / FREQS_PER_FRAME) * 360 + offset;
  const angleRad = (angleDeg / 180) * Math.PI;
  return angleRad;
}

function getTotalDbForFrequencySoFar(frequencyIndex, frameIndex) {
  let framesSoFar = spectrumData.slice(0, frameIndex);
  const totalDbs = framesSoFar
    .map((frame) => frame[frequencyIndex])
    .reduce((a, b) => a + b, 0);

  return totalDbs / MEMORY_LINE_FACTOR;
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
function clearCanvas() {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function getColorFromFrequency(fIndex) {
  const red = fIndex / Math.pow(256, 2);
  const green = (fIndex / 256) % 256;
  const blue = fIndex % 256;
  return `rgb(${red}, ${green}, ${blue})`;
}

function getRandomColor(range) {
  const color = `rgb(${Math.random() * range}, ${Math.random() * range}, ${
    Math.random() * range
  })`;
  return color;
}

function drawLine(from, to, color, width = 1) {
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = width;
  canvasCtx.beginPath();
  canvasCtx.moveTo(from[0], from[1]);
  canvasCtx.lineTo(to[0], to[1]);
  canvasCtx.stroke();
}

function drawCircle(radius, color) {
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 1;
  canvasCtx.beginPath();
  canvasCtx.arc(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, radius, 0, 2 * Math.PI);
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
