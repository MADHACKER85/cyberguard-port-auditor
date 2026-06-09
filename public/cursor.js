document.addEventListener('DOMContentLoaded', () => {
  // 1. Create mouse glow element
  const glow = document.createElement('div');
  glow.id = 'mouse-glow';
  glow.className = 'mouse-glow';
  document.body.appendChild(glow);

  // 2. Create custom cursor elements
  const cursor = document.createElement('div');
  cursor.id = 'custom-cursor';
  cursor.className = 'custom-cursor';
  document.body.appendChild(cursor);

  const dot = document.createElement('div');
  dot.id = 'custom-cursor-dot';
  dot.className = 'custom-cursor-dot';
  document.body.appendChild(dot);

  // Coordinates tracking state
  let mouseX = 0;
  let mouseY = 0;
  let cursorX = 0;
  let cursorY = 0;

  // Track position
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Fluid glow and inner dot moves instantly
    dot.style.left = `${mouseX}px`;
    dot.style.top = `${mouseY}px`;
    
    glow.style.left = `${mouseX}px`;
    glow.style.top = `${mouseY}px`;
  });

  // Spring animation loop for outer cursor circle
  function animateCursor() {
    // Spring physics formula: distance * speed factor
    cursorX += (mouseX - cursorX) * 0.16;
    cursorY += (mouseY - cursorY) * 0.16;

    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;

    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Robust delegation for hovers on dynamic and static items
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('a, button, input, select, .stat-card, .feature-card, .btn-table-action, .nav-btn');
    if (target) {
      cursor.classList.add('hover');
      dot.classList.add('hover');
      glow.classList.add('hover');
    } else {
      cursor.classList.remove('hover');
      dot.classList.remove('hover');
      glow.classList.remove('hover');
    }
  });

  // Click actions indicators
  document.addEventListener('mousedown', () => {
    cursor.classList.add('click');
    dot.classList.add('click');
  });
  document.addEventListener('mouseup', () => {
    cursor.classList.remove('click');
    dot.classList.remove('click');
  });

  // Hide cursor on window boundaries
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    dot.style.opacity = '0';
    glow.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
    dot.style.opacity = '1';
    glow.style.opacity = '0.8';
  });
});
