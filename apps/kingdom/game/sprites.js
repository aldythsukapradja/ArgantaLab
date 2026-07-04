// Procedural placeholder sprites — swap for real PixelLab / hand-drawn pixel art later.
// Everything here is drawn with canvas primitives so the prototype has zero art dependencies.
window.KingdomSprites = (function () {
  function bob(t, moving) {
    return moving ? Math.sin(t / 90) * 2 : 0;
  }

  function drawPlayer(ctx, px, py, dir, moving, t) {
    const y = py + bob(t, moving);
    ctx.save();
    ctx.translate(px, y);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = '#2f6fed';
    ctx.fillRect(-6, -2, 12, 12);
    // head
    ctx.fillStyle = '#ffd9a8';
    ctx.fillRect(-5, -14, 10, 10);
    // hair
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-5, -16, 10, 4);

    // facing indicator
    ctx.fillStyle = '#1c1c26';
    if (dir === 'down') ctx.fillRect(-2, -8, 4, 3);
    if (dir === 'up') ctx.fillRect(-2, -15, 4, 2);
    if (dir === 'left') ctx.fillRect(-6, -10, 3, 3);
    if (dir === 'right') ctx.fillRect(3, -10, 3, 3);

    ctx.restore();
  }

  const CRITTER_COLORS = {
    rabbit: { body: '#f2f0ea', accent: '#d9a5b0' },
    squirrel: { body: '#a4652f', accent: '#5c3517' },
    deer: { body: '#c68a4d', accent: '#f4ead1' },
    fox: { body: '#e0662b', accent: '#ffffff' }
  };

  function drawCritter(ctx, x, y, type, t, phase) {
    const c = CRITTER_COLORS[type] || CRITTER_COLORS.rabbit;
    const wob = Math.sin(t / 260 + phase) * 2;
    ctx.save();
    ctx.translate(x, y + wob);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = c.body;
    if (type === 'deer') {
      ctx.fillRect(-7, -6, 14, 9);
      ctx.fillRect(5, -12, 4, 7);
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(6, -16, 1, 5);
      ctx.strokeRect(9, -16, 1, 5);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.ellipse(4, -1, 2.4, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      if (type === 'rabbit') {
        ctx.fillStyle = c.body;
        ctx.fillRect(-2, -10, 2, 6);
        ctx.fillRect(2, -10, 2, 6);
      }
      if (type === 'fox') {
        ctx.fillStyle = c.body;
        ctx.beginPath();
        ctx.moveTo(-9, 2);
        ctx.lineTo(-15, -2);
        ctx.lineTo(-9, -3);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  return { drawPlayer, drawCritter };
})();
