import { mix, mixColor, rgba, snap } from "./math";
import { HORIZON_SPRITES, SATELLITE_SPRITES, SHIP_SPRITES } from "./sprites";
import { FALLBACK_COLOR, SPACE_BOTTOM, SPACE_TOP, TERRAIN_FLOOR, featureColor, makeSatellite, makeShip, makeWeatherParticle } from "./scene";
import type { DrawState, Rgb } from "./types";

function drawPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: Rgb,
  alpha: number
) {
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillRect(snap(x, size), snap(y, size), size, size);
}

function drawDottedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
  color: Rgb,
  alpha: number,
  spacing: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.floor(distance / spacing));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    drawPixel(ctx, x1 + dx * t, y1 + dy * t, size, color, alpha * (1 - t * 0.2));
  }
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  size: number,
  colors: Record<string, Rgb>,
  alpha: number,
  direction: -1 | 1
) {
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];

    for (let col = 0; col < line.length; col++) {
      const cell = line[col];
      if (cell === ".") continue;

      const mappedCol = direction === 1 ? col : line.length - 1 - col;
      const color = colors[cell];
      if (!color) continue;

      drawPixel(ctx, x + mappedCol * size, y + row * size, size, color, alpha);
    }
  }
}

function drawSky({ ctx, width, height, scene, palette, skyTime }: DrawState) {
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, rgba(SPACE_TOP, 1));
  baseGradient.addColorStop(0.42, rgba(mixColor(SPACE_TOP, palette.haze, 0.02), 1));
  baseGradient.addColorStop(1, rgba(SPACE_BOTTOM, 1));

  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  const horizon = ctx.createLinearGradient(0, height * 0.58, 0, height);
  horizon.addColorStop(0, "rgba(0, 0, 0, 0)");
  horizon.addColorStop(0.48, rgba(palette.haze, 0.01 * scene.intensity));
  horizon.addColorStop(0.74, rgba(palette.accent, 0.024 * scene.intensity));
  horizon.addColorStop(1, rgba(TERRAIN_FLOOR, 0.5));
  ctx.fillStyle = horizon;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);

  const driftX = width * (0.5 + Math.sin(skyTime * scene.skyDrift) * 0.08);
  const horizonEcho = ctx.createRadialGradient(
    driftX,
    height * 0.84,
    0,
    driftX,
    height * 0.84,
    width * 0.34
  );

  horizonEcho.addColorStop(0, rgba(palette.haze, 0.012 * scene.intensity));
  horizonEcho.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = horizonEcho;
  ctx.fillRect(0, height * 0.6, width, height * 0.4);
}

function drawCelestials({ ctx, assets, palette, timeSeconds }: DrawState) {
  for (const body of assets.celestials) {
    const pulse = 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(timeSeconds * 0.35 + body.phase));
    const bodyColor =
      body.kind === "moon"
        ? mixColor(palette.star, palette.haze, 0.24 + body.paletteMix * 0.16)
        : featureColor(palette, body.paletteMix);
    const shadowColor = mixColor(SPACE_TOP, palette.deep, 0.6);

    ctx.save();
    ctx.globalAlpha = body.alpha * pulse;

    if (body.kind === "ringed") {
      ctx.strokeStyle = rgba(mixColor(bodyColor, palette.signal, 0.35), 0.24);
      ctx.lineWidth = Math.max(1, body.radius * 0.08);
      ctx.beginPath();
      ctx.ellipse(body.x, body.y, body.radius * 1.48, body.radius * 0.5, body.ringTilt, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = rgba(bodyColor, 0.34);
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
    ctx.fill();

    if (body.kind === "giant" && body.bandCount > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
      ctx.clip();

      for (let band = 0; band < body.bandCount; band++) {
        const t = band / body.bandCount;
        const stripeColor = mixColor(bodyColor, palette.haze, 0.22 + t * 0.18);
        ctx.fillStyle = rgba(stripeColor, 0.12 + t * 0.05);
        ctx.fillRect(
          body.x - body.radius,
          body.y - body.radius + t * body.radius * 2,
          body.radius * 2,
          body.radius * 0.22
        );
      }

      ctx.restore();
    }

    ctx.fillStyle = rgba(shadowColor, 0.5);
    ctx.beginPath();
    ctx.arc(
      body.x + body.radius * body.shadowOffset,
      body.y - body.radius * 0.08,
      body.radius * 0.96,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (body.kind === "moon") {
      const craterSize = Math.max(2, assets.pixelSize);
      drawPixel(ctx, body.x - body.radius * 0.36, body.y - body.radius * 0.16, craterSize, mixColor(bodyColor, shadowColor, 0.34), 0.2);
      drawPixel(ctx, body.x - body.radius * 0.08, body.y + body.radius * 0.22, craterSize, mixColor(bodyColor, shadowColor, 0.4), 0.16);
    }

    ctx.restore();
  }
}

function drawStars({ ctx, assets, palette, timeSeconds }: DrawState) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const star of assets.stars) {
    const pulse = Math.round((0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSeconds * star.twinkle + star.phase))) * 4) / 4;
    const color = star.paletteMix < 0.72 ? palette.star : featureColor(palette, star.paletteMix);
    const alpha = star.alpha * pulse * 0.9;

    drawPixel(ctx, star.x, star.y, star.size, color, alpha);

    if (pulse > 0.72) {
      drawPixel(ctx, star.x - star.size, star.y, assets.pixelSize, color, alpha * 0.5);
      drawPixel(ctx, star.x + star.size, star.y, assets.pixelSize, color, alpha * 0.5);
      drawPixel(ctx, star.x, star.y - star.size, assets.pixelSize, color, alpha * 0.45);
      drawPixel(ctx, star.x, star.y + star.size, assets.pixelSize, color, alpha * 0.45);
    }
  }

  ctx.restore();
}

function drawConstellations({ ctx, assets, palette, timeSeconds }: DrawState) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const constellation of assets.constellations) {
    const pulse = 0.64 + 0.36 * (0.5 + 0.5 * Math.sin(timeSeconds * 0.55 + constellation.phase));
    const color = featureColor(palette, constellation.paletteMix);

    for (let point = 0; point < constellation.points.length - 1; point++) {
      const start = constellation.points[point];
      const end = constellation.points[point + 1];
      drawDottedLine(
        ctx,
        start.x,
        start.y,
        end.x,
        end.y,
        assets.pixelSize,
        color,
        constellation.alpha * pulse * 0.5,
        assets.pixelSize * 3.4
      );
    }

    for (const point of constellation.points) {
      drawPixel(ctx, point.x, point.y, assets.pixelSize, color, constellation.alpha * pulse);
    }
  }

  ctx.restore();
}

function drawSkyTrails({ ctx, assets, palette, timeSeconds }: DrawState) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const trail of assets.skyTrails) {
    const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(timeSeconds * 0.8 + trail.phase));
    const color = featureColor(palette, trail.paletteMix);

    if (trail.kind === "arc") {
      for (let segment = 0; segment <= trail.segments; segment++) {
        const t = segment / trail.segments;
        const angle = mix(trail.start, trail.end, t);
        drawPixel(
          ctx,
          trail.x + Math.cos(angle) * trail.radius,
          trail.y + Math.sin(angle) * trail.radius * 0.55,
          assets.pixelSize,
          color,
          trail.alpha * pulse * (1 - t * 0.28)
        );
      }
    }

    if (trail.kind === "ladder") {
      for (let segment = 0; segment < trail.segments; segment++) {
        const px = trail.x + trail.stepX * segment;
        const py = trail.y + trail.stepY * segment;
        drawPixel(ctx, px, py, assets.pixelSize, color, trail.alpha * pulse);

        if (segment % 2 === 0) {
          drawPixel(
            ctx,
            px,
            py + assets.pixelSize * 1.5,
            assets.pixelSize,
            mixColor(color, palette.signal, 0.5),
            trail.alpha * pulse * 0.5
          );
        }
      }
    }
  }

  ctx.restore();
}

function drawSatellites(state: DrawState) {
  const { ctx, width, height, scene, assets, palette, deltaSeconds, timeSeconds, spawnRandom } = state;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const satellite of assets.satellites) {
    const spec = SATELLITE_SPRITES[satellite.spriteId];
    const spriteWidth = spec.sprite[0].length * satellite.size;
    satellite.x += satellite.speed * satellite.direction * deltaSeconds;

    if (
      (satellite.direction === 1 && satellite.x > width + spriteWidth) ||
      (satellite.direction === -1 && satellite.x < -spriteWidth * 2)
    ) {
      Object.assign(satellite, makeSatellite(spawnRandom, width, height, assets.pixelSize, scene));
    }

    const bob = Math.sin(timeSeconds * 0.9 + satellite.phase) * satellite.size;
    const canopy = featureColor(palette, satellite.paletteMix);
    const hull = mixColor(TERRAIN_FLOOR, palette.terrain, 0.22);
    const signal = mixColor(canopy, palette.signal, 0.48);

    drawSprite(
      ctx,
      spec.sprite,
      satellite.x,
      satellite.y + bob,
      satellite.size,
      {
        "1": hull,
        "2": canopy,
        "3": signal,
        "4": palette.signal,
        "5": FALLBACK_COLOR,
      },
      satellite.alpha,
      satellite.direction
    );

    drawPixel(
      ctx,
      satellite.direction === 1 ? satellite.x - satellite.size : satellite.x + spriteWidth + satellite.size,
      satellite.y + bob + satellite.size,
      satellite.size,
      signal,
      satellite.alpha * 0.35
    );
  }

  ctx.restore();
}

function drawWeather(state: DrawState) {
  const { ctx, width, height, scene, assets, palette, deltaSeconds, timeSeconds, spawnRandom } = state;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const particle of assets.weather) {
    const angle = scene.weatherAngle + particle.angleOffset;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);

    particle.x += directionX * particle.speed * deltaSeconds;
    particle.y += directionY * particle.speed * deltaSeconds;

    if (
      particle.y - particle.length > height * 0.98 ||
      particle.x - particle.length > width + Math.max(width, height) * 0.24
    ) {
      Object.assign(particle, makeWeatherParticle(spawnRandom, width, height, assets.pixelSize, scene));
    }

    const pulseBase = 0.5 + 0.5 * Math.sin(timeSeconds * scene.pulseSpeed + particle.phase);
    const pulse = particle.kind === "comet"
      ? 0.82 + pulseBase * 0.18
      : Math.round((0.2 + pulseBase * 0.3) * 3) / 3;
    const color = particle.kind === "comet"
      ? featureColor(palette, particle.paletteMix)
      : particle.paletteMix > 0.55
        ? palette.cyan
        : palette.magenta;
    const segments = Math.max(4, Math.floor(particle.length / Math.max(particle.size * 1.35, 1)));

    if (particle.kind === "comet") {
      const halo = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.length * 0.16
      );

      halo.addColorStop(0, rgba(color, particle.alpha * 0.34));
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(
        particle.x - particle.length * 0.16,
        particle.y - particle.length * 0.16,
        particle.length * 0.32,
        particle.length * 0.32
      );
    }

    for (let segment = 0; segment < segments; segment++) {
      const progress = segment / segments;
      const alpha = particle.alpha * (1 - progress) * pulse;

      if (
        particle.kind === "rain" &&
        (segment + Math.floor(timeSeconds * 10 + particle.phase * 5)) % 2 === 0
      ) {
        continue;
      }

      drawPixel(
        ctx,
        particle.x - directionX * progress * particle.length,
        particle.y - directionY * progress * particle.length,
        particle.size,
        color,
        alpha
      );
    }
  }

  ctx.restore();
}

function drawShips(state: DrawState) {
  const { ctx, width, height, scene, assets, palette, deltaSeconds, timeSeconds, spawnRandom } = state;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (const ship of assets.ships) {
    const spec = SHIP_SPRITES[ship.pack];
    const spriteWidth = spec.sprite[0].length * ship.size;

    ship.x += ship.speed * ship.direction * deltaSeconds;

    if (
      (ship.direction === 1 && ship.x > width + spriteWidth) ||
      (ship.direction === -1 && ship.x < -spriteWidth * 2)
    ) {
      Object.assign(ship, makeShip(spawnRandom, width, height, assets.pixelSize, scene));
    }

    const bob = Math.sin(timeSeconds * 0.8 + ship.phase) * ship.size * 1.4;
    const thrusterPulse = Math.round((0.45 + 0.55 * (0.5 + 0.5 * Math.sin(timeSeconds * 6 + ship.phase))) * 3) / 3;
    const canopy = featureColor(palette, ship.paletteMix);
    const hull = mixColor(TERRAIN_FLOOR, palette.terrain, 0.38);
    const trim = mixColor(canopy, palette.signal, 0.42);
    const thruster = ship.paletteMix > 0.52 ? palette.warm : palette.accent;

    if (ship.trailLength > 0) {
      for (let trail = 0; trail < ship.trailLength; trail += assets.pixelSize * 1.8) {
        drawPixel(
          ctx,
          ship.direction === 1 ? ship.x - trail : ship.x + spriteWidth + trail,
          ship.y + bob + ship.size * 1.5,
          assets.pixelSize,
          trim,
          ship.alpha * 0.18 * (1 - trail / ship.trailLength)
        );
      }
    }

    drawSprite(
      ctx,
      spec.sprite,
      ship.x,
      ship.y + bob,
      ship.size,
      {
        "1": hull,
        "2": canopy,
        "3": thruster,
        "4": trim,
        "5": mixColor(hull, palette.deep, 0.42),
      },
      ship.alpha,
      ship.direction
    );
    drawPixel(
      ctx,
      ship.x + spriteWidth * 0.5,
      ship.y + bob + ship.size * (spec.sprite.length + 0.5),
      assets.pixelSize,
      thruster,
      ship.alpha * thrusterPulse * 0.42
    );
  }

  ctx.restore();
}

function drawTerrain(state: DrawState) {
  const { ctx, width, height, scene, assets, palette } = state;
  const paths = assets.terrainPaths;
  if (paths.length === 0) return;

  for (let i = 0; i < scene.terrainLayers.length; i++) {
    const layer = scene.terrainLayers[i];
    const fill = mixColor(TERRAIN_FLOOR, palette.terrain, layer.opacity);
    const line = featureColor(palette, 0.24 + i * 0.18);
    const path = paths[i];

    const gradient = ctx.createLinearGradient(0, height * layer.baseY, 0, height);
    gradient.addColorStop(0, rgba(fill, 0.86));
    gradient.addColorStop(1, rgba(TERRAIN_FLOOR, 1));

    ctx.fillStyle = gradient;
    ctx.fill(path);
    ctx.strokeStyle = rgba(line, layer.lineOpacity);
    ctx.lineWidth = i === scene.terrainLayers.length - 1 ? 1.25 : 0.9;
    ctx.stroke(path);

    const haze = ctx.createLinearGradient(0, height * (layer.baseY - 0.05), 0, height);
    haze.addColorStop(0, rgba(line, 0.018));
    haze.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, height * (layer.baseY - 0.08), width, height * 0.22);
  }
}

function drawHorizonProps(state: DrawState) {
  const { ctx, scene, assets, palette, timeSeconds } = state;

  for (let i = 0; i < assets.horizonProps.length; i++) {
    const prop = assets.horizonProps[i];
    const groundY = assets.horizonGroundY[i];
    const structureColor = mixColor(TERRAIN_FLOOR, palette.terrain, 0.18 + prop.layerIndex * 0.08);
    const accentColor = featureColor(palette, prop.paletteMix);
    const pulse = Math.round((0.4 + 0.6 * (0.5 + 0.5 * Math.sin(timeSeconds * scene.pulseSpeed + prop.phase))) * 3) / 3;
    const spec = HORIZON_SPRITES[prop.spriteId];
    const cellSize = Math.max(1, Math.round(assets.pixelSize * prop.scale));
    const spriteWidth = spec.sprite[0].length * cellSize;
    const spriteHeight = spec.sprite.length * cellSize;
    const px = snap(prop.x - spriteWidth * 0.5, assets.pixelSize);
    const py = snap(groundY - spriteHeight, assets.pixelSize);

    drawSprite(
      ctx,
      spec.sprite,
      px,
      py,
      cellSize,
      {
        "1": structureColor,
        "2": accentColor,
        "3": mixColor(accentColor, palette.signal, 0.5),
        "4": mixColor(accentColor, palette.warm, 0.35),
        "5": mixColor(structureColor, palette.deep, 0.42),
      },
      prop.alpha,
      1
    );

    drawPixel(
      ctx,
      prop.x,
      py + spriteHeight - cellSize * 1.5,
      assets.pixelSize,
      accentColor,
      prop.alpha * pulse * 0.4
    );
  }
}

export function drawSceneFrame(state: DrawState) {
  const { ctx, width, height } = state;

  ctx.clearRect(0, 0, width, height);
  drawSky(state);
  drawCelestials(state);
  drawStars(state);
  drawConstellations(state);
  drawSkyTrails(state);
  drawSatellites(state);
  drawWeather(state);
  drawShips(state);
  drawTerrain(state);
  drawHorizonProps(state);

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.3,
    height * 0.18,
    width * 0.5,
    height * 0.58,
    Math.max(width, height) * 0.82
  );

  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.56)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
