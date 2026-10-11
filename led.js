const byId = id => document.getElementById(id);

const MAX_CURRENT_MA = 20;

let ledName;
let forwardVoltage;
let ledColor;
let resistance;
let voltage;
let current = 0;
let brightness = 0;

let chartForwardVoltage;
let chartAnimation;

const graphPoints = [];

function fillRange(slider) {
  const fraction = (slider.value - slider.min) / (slider.max - slider.min);
  slider.style.setProperty('--p', (fraction * 100) + '%');
}

function calcCurrentMA(volts, vf = forwardVoltage) {
  return Math.max(0, (volts - vf) / resistance * 1000);
}

function getAnchor() {
  return graphPoints.length
    ? graphPoints[graphPoints.length - 1]
    : { v: chartForwardVoltage, i: 0 };
}

function graphCurrentAt(volts, vf = chartForwardVoltage) {
  const anchor = getAnchor();
  const rise = calcCurrentMA(volts, vf) - calcCurrentMA(anchor.v, vf);
  return Math.max(0, anchor.i + rise);
}

function update() {
  const typeParts = byId('type').value.split('|');
  ledName = typeParts[0];
  forwardVoltage = +typeParts[1];
  ledColor = typeParts[2];

  if (chartForwardVoltage === undefined) chartForwardVoltage = forwardVoltage;

  resistance = +byId('res').value;
  voltage = +byId('vol').value;

  current = calcCurrentMA(voltage);
  brightness = Math.min(100, current / MAX_CURRENT_MA * 100);

  byId('rv').textContent = resistance + ' Ω';
  byId('vv').textContent = voltage.toFixed(1) + ' V';

  byId('bright').value = brightness;
  byId('bv').textContent = Math.round(brightness) + '%';

  [byId('res'), byId('vol'), byId('bright')].forEach(fillRange);

  byId('led').style.setProperty('--c', ledColor);

  byId('halo').setAttribute('opacity', (brightness / 100 * .95).toFixed(2));

  byId('o1').textContent = resistance + ' Ω';
  byId('o2').textContent = voltage.toFixed(1) + ' V';
  byId('o3').textContent = ledName + ' (' + forwardVoltage + ' V)';
  byId('o4').textContent = current.toFixed(2) + ' mA';
  byId('o5').textContent = (voltage * current).toFixed(1) + ' mW';

  const warning = byId('warn');
  warning.className = '';

  if (current > 30) {
    warning.textContent =
      'Current is above 30 mA. A real LED would burn out. Raise the resistance or lower the voltage.';
    warning.className = 'bad';
  } else if (voltage < forwardVoltage) {
    warning.textContent =
      'Below ' + forwardVoltage + ' V the junction is not forward biased enough. No current flows and no light is emitted.';
  } else {
    warning.textContent =
      'Electrons and holes recombine at the junction and release energy as light.';
  }

  if (forwardVoltage !== chartForwardVoltage) {
    animateChartTo(forwardVoltage);
  } else {
    drawIV();
  }
}

function drawIV() {
  const WIDTH = 440;
  const HEIGHT = 300;
  const LEFT = 40;
  const BOTTOM = 30;
  const TOP = 20;
  const RIGHT = 20;

  const MAX_VOLTS = 12;
  const MAX_MA = 40;

  const xPos = volts => LEFT + volts / MAX_VOLTS * (WIDTH - LEFT - RIGHT);
  const yPos = mA => HEIGHT - BOTTOM - Math.min(mA, MAX_MA) / MAX_MA * (HEIGHT - BOTTOM - TOP);

  let svg = '';

  for (let step = 0; step <= 6; step++) {
    const gridX = LEFT + step / 6 * (WIDTH - LEFT - RIGHT);
    svg += `<line x1="${gridX}" y1="${TOP}" x2="${gridX}" y2="${HEIGHT - BOTTOM}" stroke="var(--grid)" stroke-dasharray="3 4"/>`;
    svg += `<text x="${gridX}" y="${HEIGHT - 10}" font-size="11" fill="var(--mute)" text-anchor="middle">${step * 2}</text>`;
  }

  for (let step = 0; step <= 4; step++) {
    const gridY = yPos(step * 10);
    svg += `<line x1="${LEFT}" y1="${gridY}" x2="${WIDTH - RIGHT}" y2="${gridY}" stroke="var(--grid)" stroke-dasharray="3 4"/>`;
    svg += `<text x="${LEFT - 6}" y="${gridY + 4}" font-size="11" fill="var(--mute)" text-anchor="end">${step * 10}</text>`;
  }

  const anchor = getAnchor();

  if (graphPoints.length) {
    let recordedPath = 'M' + xPos(chartForwardVoltage).toFixed(1) + ' ' + yPos(0).toFixed(1);
    graphPoints.forEach(point => {
      recordedPath += 'L' + xPos(point.v).toFixed(1) + ' ' + yPos(point.i).toFixed(1);
    });
    svg += `<path d="${recordedPath}" fill="none" stroke="var(--pri)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  let curvePath = '';
  for (let step = 0; ; step++) {
    const volts = anchor.v + step * .1;
    if (volts > MAX_VOLTS) break;
    const command = step ? 'L' : 'M';
    curvePath += command + xPos(volts).toFixed(1) + ' ' + yPos(graphCurrentAt(volts)).toFixed(1);
  }
  const dashStyle = graphPoints.length ? ' stroke-dasharray="8 6"' : '';
  svg += `<path d="${curvePath}" fill="none" stroke="var(--pri)" stroke-width="3.5" stroke-linecap="round"${dashStyle}/>`;

  svg += `<line x1="${LEFT}" y1="${TOP}" x2="${LEFT}" y2="${HEIGHT - BOTTOM}" stroke="var(--ink)" stroke-width="2"/>`;
  svg += `<line x1="${LEFT}" y1="${HEIGHT - BOTTOM}" x2="${WIDTH - RIGHT}" y2="${HEIGHT - BOTTOM}" stroke="var(--ink)" stroke-width="2"/>`;

  svg += `<text x="${(LEFT + WIDTH - RIGHT) / 2}" y="${HEIGHT}" font-size="11" fill="var(--mute)" text-anchor="middle" dy="-0">Voltage (V)</text>`;
  const middleY = (TOP + HEIGHT - BOTTOM) / 2;
  svg += `<text x="12" y="${middleY}" font-size="11" fill="var(--mute)" text-anchor="middle" transform="rotate(-90 12 ${middleY})">Current (mA)</text>`;

  graphPoints.forEach((point, index) => {
    const row = recordedRows[index];
    svg += `<circle cx="${xPos(point.v)}" cy="${yPos(point.i)}" r="5" fill="var(--pri2)" stroke="var(--bg)" stroke-width="2"><title>${row[0]} V, ${row[1]} mA</title></circle>`;
  });

  svg += `<circle cx="${xPos(voltage)}" cy="${yPos(graphCurrentAt(voltage))}" r="7" fill="#fff" stroke="var(--pri)" stroke-width="3"/>`;

  byId('iv').innerHTML = svg;
}

function animateChartTo(targetVf) {
  cancelAnimationFrame(chartAnimation);

  const startVf = chartForwardVoltage;
  const startTime = performance.now();
  const DURATION = 500;

  function step(now) {
    const progress = Math.min(1, (now - startTime) / DURATION);
    const eased = 1 - Math.pow(1 - progress, 3);

    chartForwardVoltage = progress < 1
      ? startVf + (targetVf - startVf) * eased
      : targetVf;

    drawIV();
    if (progress < 1) chartAnimation = requestAnimationFrame(step);
  }

  chartAnimation = requestAnimationFrame(step);
}

function popLed() {
  const led = byId('led');
  led.classList.remove('switching');
  led.getBoundingClientRect();

  led.classList.add('switching');
}

byId('led').addEventListener('animationend', () => {
  byId('led').classList.remove('switching');
});

const particles = [];
let lastFrameTime = 0;
let timeSinceSpawn = 0;
const SVG_NS = 'http://www.w3.org/2000/svg';

const JUNCTION_Y = 185;

function spawn() {
  if (voltage <= 0) return;

  const flow = Math.min(1, current / MAX_CURRENT_MA);

  const spawnChance = voltage >= forwardVoltage ? .15 + flow * .85 : .04;
  if (Math.random() > spawnChance) return;

  const isElectron = Math.random() < .5;

  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('r', 5);
  circle.setAttribute('fill', isElectron ? '#2a5bd7' : '#fff');
  circle.setAttribute('stroke', isElectron ? 'none' : '#d6336c');
  circle.setAttribute('stroke-width', 2);
  byId('parts').appendChild(circle);

  particles.push({
    el: circle,
    e: isElectron,
    x: 132 + Math.random() * 36,
    y: isElectron ? 250 : 105,
    ph: 0,
    t: 0
  });
}

function tick(timestamp) {
  const dt = Math.min(50, timestamp - lastFrameTime);
  lastFrameTime = timestamp;

  timeSinceSpawn += dt;
  if (timeSinceSpawn > 110) {
    timeSinceSpawn = 0;
    spawn();
  }

  const canCross = voltage >= forwardVoltage;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    if (p.ph === 0) {
      const speed = dt * (.04 + Math.min(1, current / MAX_CURRENT_MA) * .07);

      const stopY = canCross ? JUNCTION_Y : (p.e ? 215 : 155);

      const direction = p.y < stopY ? 1 : -1;
      p.y += direction * Math.min(Math.abs(stopY - p.y), speed);

      if (canCross && Math.abs(p.y - JUNCTION_Y) < 3) {
        p.ph = 1;
        p.t = 0;
        p.el.setAttribute('fill', ledColor);
        p.el.setAttribute('stroke', 'none');
        p.el.setAttribute('r', 4);
      } else if (!canCross && Math.abs(p.y - stopY) < 1) {
        p.t += dt;
        if (p.t > 1500) {
          p.el.remove();
          particles.splice(i, 1);
          continue;
        }
      }
    } else {
      p.t += dt;
      p.x += Math.sin(i) * .4;
      p.y -= .05 * dt * (i % 2 ? 1 : -1);
      p.el.setAttribute('r', 4 + p.t / 60);
      p.el.setAttribute('opacity', Math.max(0, 1 - p.t / 600));

      if (p.t > 600) {
        p.el.remove();
        particles.splice(i, 1);
        continue;
      }
    }

    p.el.setAttribute('cx', p.x);
    p.el.setAttribute('cy', p.y);
  }

  requestAnimationFrame(tick);
}

const recordedRows = [];

function renderTable() {
  byId('rows').innerHTML = recordedRows
    .map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`)
    .join('');

  byId('empty').style.display = recordedRows.length ? 'none' : 'block';
}

byId('rec').onclick = () => {
  recordedRows.push([
    voltage.toFixed(1),
    current.toFixed(2),
    Math.round(brightness)
  ]);

  graphPoints.push({ v: voltage, i: graphCurrentAt(voltage, forwardVoltage) });
  renderTable();
  drawIV();
};

byId('clr').onclick = () => {
  recordedRows.length = 0;
  graphPoints.length = 0;
  renderTable();
  drawIV();
};

['res', 'vol', 'type'].forEach(id => {
  byId(id).addEventListener('input', update);
});

byId('type').addEventListener('change', popLed);

update();
renderTable();
requestAnimationFrame(tick);
