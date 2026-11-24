// The simulated car: a top view (windows, doors, seats, sunroof, trunk) and the cabin settings.
import type { CarState } from '../rn/car/CarState';
import { getCarActions, setDriving } from '../rn/car/CarState';

const windowOpen = (p: string) => (p === 'open' ? 1 : p === 'half' ? 0.5 : p === 'crack' ? 0.2 : 0);
const levelDots = (l: string) => ({ off: 0, low: 1, medium: 2, high: 3 } as Record<string, number>)[l] ?? 0;

function carSvg(s: CarState): string {
    const win = (x: number, y: number, w: number, h: number, pos: keyof CarState['windows']) => {
        const open = windowOpen(s.windows[pos]);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="glass"/>` +
            (open ? `<rect x="${x}" y="${y}" width="${w}" height="${h * open}" rx="3" class="open"/>` : '');
    };
    const seat = (x: number, y: number, seatName: keyof CarState['seatHeater']) => {
        const heat = levelDots(s.seatHeater[seatName]);
        return `<rect x="${x}" y="${y}" width="34" height="38" rx="8" class="seat ${heat ? 'warm' : ''}"/>` +
            (heat ? `<text x="${x + 17}" y="${y + 25}" class="seat-text">${'•'.repeat(heat)}</text>` : '');
    };
    const door = (x: number, y: number, h: number, pos: keyof CarState['doors']) =>
        `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" class="door ${s.doors[pos] === 'open' ? 'open' : ''} ${s.doorLocks[pos] ? 'locked' : ''}"/>`;
    return `
    <svg viewBox="0 0 160 280" class="car-svg" role="img" aria-label="Car top view">
      <rect x="22" y="10" width="116" height="260" rx="44" class="body"/>
      ${s.frunk === 'open' ? '<rect x="40" y="0" width="80" height="22" rx="8" class="open-lid"/>' : ''}
      ${s.trunk === 'open' ? '<rect x="40" y="258" width="80" height="22" rx="8" class="open-lid"/>' : ''}
      <rect x="36" y="56" width="88" height="22" rx="6" class="glass ${s.defrost.windshield ? 'defrost' : ''}"/>
      <rect x="50" y="108" width="60" height="44" rx="8" class="roof ${s.sunroof !== 'close' ? 'sunroof-open' : ''}"/>
      ${win(24, 90, 10, 50, 'front_left')}${win(126, 90, 10, 50, 'front_right')}
      ${win(24, 160, 10, 50, 'rear_left')}${win(126, 160, 10, 50, 'rear_right')}
      ${door(23, 88, 54, 'front_left')}${door(137, 88, 54, 'front_right')}
      ${door(23, 158, 54, 'rear_left')}${door(137, 158, 54, 'rear_right')}
      ${seat(42, 96, s.vehicle?.steering === 'right' ? 'passenger' : 'driver')}${seat(84, 96, s.vehicle?.steering === 'right' ? 'driver' : 'passenger')}
      ${seat(42, 168, 'rear_left')}${seat(84, 168, 'rear_right')}
      <rect x="36" y="222" width="88" height="18" rx="6" class="glass ${s.defrost.rear ? 'defrost' : ''}"/>
      ${s.locked ? '<text x="80" y="140" class="lock">🔒</text>' : ''}
      ${s.ambient.on ? `<rect x="22" y="10" width="116" height="260" rx="44" class="ambient" style="stroke:${s.ambient.color || '#7dd3fc'}"/>` : ''}
    </svg>`;
}

export function renderCar(el: HTMLElement, s: CarState) {
    const unit = s.temperature.unit === 'fahrenheit' ? '°F' : '°C';
    const media = s.muted ? 'Muted' : s.media ?? s.radio ?? 'Off';
    const last = getCarActions().slice(-3).reverse();
    el.innerHTML = `
      <div class="car-grid">
        ${carSvg(s)}
        <div class="car-info">
          <div class="row"><span>Driver</span><b>${s.temperature.driver}${unit}</b></div>
          <div class="row"><span>Passenger</span><b>${s.temperature.passenger}${unit}</b></div>
          <div class="row"><span>Fan</span><b>${s.fan}</b></div>
          <div class="row"><span>Doors</span><b>${s.locked ? 'Locked' : 'Unlocked'}</b></div>
          <div class="row"><span>Sunroof</span><b>${s.sunroof}</b></div>
          <div class="row"><span>Media</span><b>${media}${s.muted ? '' : ` · ${s.volume}`}</b></div>
          ${s.destination ? `<div class="row"><span>Going to</span><b>${s.destination}</b></div>` : ''}
          <label class="row switch"><span>Driving</span><input type="checkbox" id="driving" ${s.driving ? 'checked' : ''}></label>
        </div>
      </div>
      ${last.length ? `<ul class="actions">${last.map((a) => `<li class="${a.ok ? '' : 'blocked'}">${a.summary}</li>`).join('')}</ul>` : ''}`;
    const driving = el.querySelector('#driving') as HTMLInputElement | null;
    if (driving) driving.onchange = () => setDriving(driving.checked);
}
