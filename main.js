const FPS = 24;
const FFT_SIZE = 512;
const VIEW_HEIGHT = 1000;
const VIEW_WIDTH = 1000;
const FREQS_PER_FRAME = 150; // cut off upper range frequencies, 255 max

// drawing consts
const MEMORY_LINE_FILL_SPEED_FACTOR = 200;
const CURRENT_LINE_THICKNESS = 3;
const CURRENT_LINE_COLOR_RANGE = 150;
const CIRCLE_RADIUS_FACTOR = 60;
const CIRCLE_COLOR = "green";
const SPIN_BACKGROUND = false;

// progress consts
const firstThresh = VIEW_WIDTH / 2;
const secondThresh = VIEW_WIDTH;
const thirdThresh = VIEW_WIDTH + VIEW_WIDTH / 2;
const fourthThresh = VIEW_WIDTH * 2;
const fifthThresh = VIEW_WIDTH * 2 + VIEW_WIDTH;

let audioCtx, audioOff, analyser, canvas, canvasCtx;
let sampleRate;
let playButton, pauseButton, stopButton, audioElem;
let spectrumData;
let intervalId;
let songSrc;
let song1Btn, song2Btn, song3Btn, song4Btn, song5Btn, song6Btn, song7Btn;
let totalDbRadius = 0;

function startup() {
  // dom parsing
  song1Btn = document.getElementById("song1");
  song2Btn = document.getElementById("song2");
  song3Btn = document.getElementById("song3");
  song4Btn = document.getElementById("song4");
  song5Btn = document.getElementById("song5");
  song6Btn = document.getElementById("song6");
  song7Btn = document.getElementById("song7");
  playButton = document.getElementById("play");
  pauseButton = document.getElementById("play");
  stopButton = document.getElementById("stop");
  audioElem = document.getElementById("audio");

  // event handling
  song1Btn.onclick = () => handlePlaySong("./tunes/yours.mp3");
  song2Btn.onclick = () => handlePlaySong("./tunes/follies.mp3");
  song3Btn.onclick = () => handlePlaySong("./tunes/idontknow.mp3");
  song4Btn.onclick = () => handlePlaySong("./tunes/everlong.mp3");
  song5Btn.onclick = () => handlePlaySong("./tunes/triangle.mp3");
  song6Btn.onclick = () => handlePlaySong("./tunes/enth.mp3");
  song7Btn.onclick = () => handlePlaySong("./tunes/stranded.mp3");

  stopButton.onclick = stopAudio;

  // canvas
  canvas = document.getElementById("canvas");
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  canvasCtx = canvas.getContext("2d");
}

function handlePlaySong(url) {
  stopAudio();
  loadAudio(url).then(() => playAudio(url));
}

function loadAudio(url) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return fetch(url)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
    .then(getAudioData);
}

async function playAudio(url) {
  audioElem.src = url;
  audioElem.play();
  // audioElem.muted = true;

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
    drawTriangleProgress(frameIndex);
    drawFrequency(frequency, i, frameIndex);
    i++;
  }

  drawBeatCircle(frameIndex);
  drawProgress(frameIndex);
  drawDb(frameIndex);
}

function drawFrequency(db, index, frameIndex) {
  drawFrequencySoFar(index, frameIndex);
  drawFrequencyTriangle(index, frameIndex);
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

function drawFrequencySoFar(freqIndex, frameIndex) {
  let lineLength = getTotalDbForFrequencySoFar(freqIndex, frameIndex);

  let color, length;

  // 1st gray line
  drawMemoryLine(freqIndex, frameIndex, lineLength, "rgb(100, 100, 100)");

  if (lineLength > firstThresh) {
    // 2nd black line
    color = "black";
    const padding = 20;
    length = Math.min(
      lineLength - firstThresh - padding,
      VIEW_WIDTH / 2 - padding
    );
    drawMemoryLine(freqIndex, frameIndex, length, color);
  }

  if (lineLength > secondThresh) {
    // 3nd blue line
    color = "blue";
    const padding = 60;
    length = Math.min(
      lineLength - secondThresh - padding,
      VIEW_WIDTH / 2 - padding
    );
    drawMemoryLine(freqIndex, frameIndex, length, color);
  }

  if (lineLength > thirdThresh) {
    // 4th green line
    color = "green";
    const padding = 100;
    length = Math.min(
      lineLength - thirdThresh - padding,
      VIEW_WIDTH / 2 - padding
    );
    drawMemoryLine(freqIndex, frameIndex, length, color);
  }

  if (lineLength > fourthThresh) {
    // red line
    color = "red";
    const padding = 120;
    length = Math.min(
      lineLength - fourthThresh - padding,
      VIEW_WIDTH / 2 - padding
    );
    drawMemoryLine(freqIndex, frameIndex, length, color);
  }
}

function drawFrequencyTriangle(freqIndex, frameIndex) {
  const lineLength = getTotalDbForFrequencySoFar(freqIndex, frameIndex);
  const color1 = getProgressColorForFrequency(freqIndex, frameIndex);
  const color2 = getProgressColorForFrequency(freqIndex + 1, frameIndex);
  // const alpha = frameIndex / spectrumData.length / 2;
  const alpha = Math.max((lineLength % VIEW_WIDTH) / VIEW_WIDTH, 0.3);
  const mixedColor = mixColors(color1, color2, alpha);

  const length = (frameIndex / spectrumData.length) * VIEW_WIDTH;
  // const length = 250;
  drawMemoryTriangle(freqIndex, length, mixedColor);
}

function mixColors(color1, color2, alpha = 1) {
  if (color1 === color2) {
    if (color1 === "rgb(0, 0, 0)") {
      return `rgba(${100}, ${100}, ${100}, ${alpha})`; // hehe
    }
    const color1arr = toRGBArray(color1);
    return `rgba(${color1arr[0]}, ${color1arr[1]}, ${color1arr[2]}, ${alpha})`;
  }

  const colors = [color1, color2];

  if (colors.includes("rgb(255, 0, 0)") && colors.includes("rgb(0, 255, 0)")) {
    return `rgba(${139}, ${116}, ${0}, ${alpha})`;
  }

  if (colors.includes("rgb(255, 0, 0)") && colors.includes("rgb(0, 0, 255)")) {
    return `rgba(${139}, ${0}, ${116}, ${alpha})`;
  }

  return `rgba(${0}, ${139}, ${116}, ${alpha})`;
}

function toRGBArray(rgbStr) {
  return rgbStr.match(/\d+/g).map(Number);
}

function getProgressColorForFrequency(freqIndex, frameIndex) {
  let lineLength = getTotalDbForFrequencySoFar(freqIndex, frameIndex);

  let color = "rgb(100, 100, 100)";
  if (lineLength > firstThresh) {
    color = "rgb(0, 0, 0)";
  }
  if (lineLength > secondThresh) {
    color = "rgb(0, 0, 255)";
  }
  if (lineLength > thirdThresh) {
    color = "rgb(0, 255, 0)";
  }
  if (lineLength > fourthThresh) {
    color = "rgb(255, 0, 0)";
  }

  return color;
}

function drawMemoryTriangle(freqIndex, length, color) {
  const point1 = [VIEW_WIDTH / 2, VIEW_HEIGHT / 2];

  const angleRad2 = getAngleRadsForFrequency(freqIndex);
  let basePosition2 = [point1[0] + length, point1[1]];
  let rotatedPosition2 = rotate(basePosition2, point1, angleRad2);
  const point2 = rotatedPosition2;

  const angleRad3 = getAngleRadsForFrequency(freqIndex + 1);
  let basePosition3 = [point1[0] + length, point1[1]];
  let rotatedPosition3 = rotate(basePosition3, point1, angleRad3);
  const point3 = rotatedPosition3;

  drawTriangle(point1, point2, point3, color);
}

function drawMemoryLine(
  freqIndex,
  frameIndex,
  length,
  color,
  spinBackground = false
) {
  const from = [VIEW_WIDTH / 2, VIEW_HEIGHT / 2];

  let frameDegOffset = (frameIndex + 360) % 360;

  if (!spinBackground) {
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
  totalDbRadius += radius;

  drawCircle(radius, CIRCLE_COLOR);
}

function drawDb(frameIndex) {
  const dbs = spectrumData[frameIndex].reduce((a, b) => a + b, 0);

  canvasCtx.fillStyle = "red";
  canvasCtx.fillText(dbs, 10, VIEW_HEIGHT - 20);

  const totalDbd = getTotalDbForFrequencySoFar(0, frameIndex);

  canvasCtx.fillStyle = "blue";
  canvasCtx.fillText(totalDbd, VIEW_WIDTH - 50, 10);
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

function drawTriangleProgress(frameIndex) {
  const maxPercent = 0.1;
  const progress = Math.min(frameIndex / spectrumData.length, maxPercent);
  const progressLength = progress * VIEW_WIDTH;
  const color = "rgba(100, 100, 100, 1)";

  // upper
  const point1Upper = [0, 0];
  const point2Upper = [0, progressLength];
  const point3Upper = [progressLength, 0];

  drawTriangle(point1Upper, point2Upper, point3Upper, color);

  // lower
  const point1Lower = [VIEW_WIDTH, VIEW_HEIGHT];
  const point2Lower = [VIEW_WIDTH, VIEW_HEIGHT - progressLength];
  const point3Lower = [VIEW_WIDTH - progressLength, VIEW_HEIGHT];

  drawTriangle(point1Lower, point2Lower, point3Lower, color);
}

function getAngleRadsForFrequency(freqIndex, offset = 0) {
  const angleDeg = (freqIndex / FREQS_PER_FRAME) * 360 + offset;
  const angleRad = (angleDeg / 180) * Math.PI;
  return angleRad;
}

function getTotalDbForFrequencySoFar(frequencyIndex, frameIndex) {
  let framesSoFar = spectrumData.slice(0, frameIndex);
  const totalDbs = framesSoFar
    .map((frame) => frame[frequencyIndex])
    .reduce((a, b) => a + b, 0);

  return totalDbs / MEMORY_LINE_FILL_SPEED_FACTOR;
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

function drawTriangle(point1, point2, point3, color, width = 1) {
  canvasCtx.fillStyle = color;
  canvasCtx.lineWidth = width;
  canvasCtx.beginPath();
  canvasCtx.moveTo(point1[0], point1[1]);
  canvasCtx.lineTo(point2[0], point2[1]);
  canvasCtx.lineTo(point3[0], point3[1]);
  canvasCtx.fill();
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
