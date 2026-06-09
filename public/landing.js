document.addEventListener('DOMContentLoaded', () => {
  // ========================================================
  // 1. INTERACTIVE 3D CYBER ATTACK MAP GLOBE
  // ========================================================
  const canvas = document.getElementById('live-bg-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    
    // Globe State Variables
    let rotX = 0.4;  // Sphere horizontal tilt angle
    let rotY = 0;    // Sphere vertical rotation angle
    let globeRadius = 240;
    let centerX = canvas.width * 0.6;
    let centerY = canvas.height * 0.5;

    let points = [];     // Fibonacci sphere points grid
    let attacks = [];    // Active cyberattack beam animations
    let explosions = []; // Hit impact particle bursts

    // Major cyber hubs city nodes (coordinates in radians)
    const cities = [
      { name: 'London', lat: 0.90, lon: 0.00 },
      { name: 'New York', lat: 0.71, lon: -1.29 },
      { name: 'Tokyo', lat: 0.62, lon: 2.44 },
      { name: 'Sydney', lat: -0.59, lon: 2.64 },
      { name: 'Moscow', lat: 0.97, lon: 0.66 },
      { name: 'Rio de Janeiro', lat: -0.40, lon: -0.75 },
      { name: 'Mumbai', lat: 0.33, lon: 1.27 },
      { name: 'Cape Town', lat: -0.59, lon: 0.32 },
      { name: 'Singapore', lat: 0.02, lon: 1.81 },
      { name: 'San Francisco', lat: 0.66, lon: -2.14 },
      { name: 'Reykjavik', lat: 1.12, lon: -0.38 },
      { name: 'Dubai', lat: 0.44, lon: 0.97 }
    ];

    // Helper: Approximate bounding box checker to render world continents
    function isContinentLand(lat, lon) {
      const la = lat * 180 / Math.PI;
      const lo = lon * 180 / Math.PI;

      // North America
      if (la > 10 && la < 72 && lo > -168 && lo < -52) return true;
      // South America
      if (la > -56 && la < 12 && lo > -82 && lo < -34) return true;
      // Africa
      if (la > -35 && la < 35 && lo > -18 && lo < 51) return true;
      // Europe & Asia (Eurasia)
      if (la > 10 && la < 78 && lo > -10 && lo < 180) return true;
      // Australia
      if (la > -42 && la < -10 && lo > 112 && lo < 154) return true;
      // Greenland
      if (la > 60 && la < 83 && lo > -73 && lo < -10) return true;

      return false;
    }

    // Initialize Fibonacci Sphere grid nodes
    function generateSpherePoints() {
      points = [];
      const numPoints = 1200; // density of sphere grid
      const goldenRatio = (1 + Math.sqrt(5)) / 2;

      for (let i = 0; i < numPoints; i++) {
        const theta = 2 * Math.PI * i / goldenRatio;
        const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
        const lat = phi - Math.PI / 2;
        const lon = theta;

        const isLand = isContinentLand(lat, lon);
        points.push({ lat, lon, isLand });
      }
    }

    // Resize canvas and dynamically adjust globe positioning
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      centerX = window.innerWidth > 950 ? canvas.width * 0.6 : canvas.width * 0.5;
      centerY = canvas.height * 0.5;
      globeRadius = Math.min(canvas.width, canvas.height) * (window.innerWidth > 950 ? 0.32 : 0.38);
      if (globeRadius < 150) globeRadius = 150;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    generateSpherePoints();

    // 3D Point Projection onto 2D Canvas Screen
    function project3DPoint(lat, lon, radius) {
      const radLat = lat;
      const radLon = lon + rotY; // Horizontal rotation angle offset

      // 1. Spherical to 3D Cartesian coordinates
      let x = Math.cos(radLat) * Math.sin(radLon);
      let y = Math.sin(radLat);
      let z = Math.cos(radLat) * Math.cos(radLon);

      // 2. Rotate around X-axis (Tilt angle rotX)
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const yNew = y * cosX - z * sinX;
      const zNew = y * sinX + z * cosX;

      x = x * radius;
      y = yNew * radius;
      z = zNew * radius;

      // Output projected screen coordinates
      const screenX = centerX + x;
      const screenY = centerY - y; // Invert y-axis for standard screen coords

      return {
        x: screenX,
        y: screenY,
        z: z,
        visible: z > -50 // Visible if on front-facing hemisphere
      };
    }

    // Explosion Particle Class
    class ParticleBurst {
      constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1.0;
        this.particles = [];

        // Spawn vector velocity particles
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 2.5 + 0.8;
          this.particles.push({
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            px: 0,
            py: 0,
            size: Math.random() * 2 + 1
          });
        }
      }

      update() {
        this.life -= 0.025;
        this.particles.forEach(p => {
          p.px += p.dx;
          p.py += p.dy;
        });
      }

      draw() {
        this.particles.forEach(p => {
          ctx.beginPath();
          ctx.arc(this.x + p.px, this.y + p.py, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `${this.color}${this.life})`;
          ctx.fill();
        });
      }
    }

    // Laser Cyber Attack Arc Class
    class CyberAttack {
      constructor() {
        this.start = cities[Math.floor(Math.random() * cities.length)];
        do {
          this.end = cities[Math.floor(Math.random() * cities.length)];
        } while (this.start === this.end);

        this.progress = 0;
        this.speed = Math.random() * 0.012 + 0.008;
        this.arcHeight = Math.random() * 60 + 30; // height offset of beam orbit
        // Color choice: Cyan or Magenta
        this.color = Math.random() > 0.5 ? 'rgba(0, 240, 255, ' : 'rgba(189, 0, 255, ';
      }

      update() {
        this.progress += this.speed;
        if (this.progress >= 1.0) {
          this.progress = 1.0;
          
          // Trigger explosion burst at target city
          const targetProj = project3DPoint(this.end.lat, this.end.lon, globeRadius);
          if (targetProj.visible) {
            explosions.push(new ParticleBurst(targetProj.x, targetProj.y, this.color));
          }
        }
      }

      draw() {
        const pathPoints = [];
        const resolution = 20;
        const currentSteps = Math.floor(this.progress * resolution);

        for (let i = 0; i <= currentSteps; i++) {
          const t = i / resolution;
          // Interpolate coordinates
          const lat = this.start.lat + (this.end.lat - this.start.lat) * t;
          const lon = this.start.lon + (this.end.lon - this.start.lon) * t;
          
          // Orbit altitude
          const currentRadius = globeRadius + Math.sin(t * Math.PI) * this.arcHeight;
          const proj = project3DPoint(lat, lon, currentRadius);
          if (proj.visible) {
            pathPoints.push(proj);
          }
        }

        if (pathPoints.length > 1) {
          // Draw connecting laser beam path
          ctx.beginPath();
          ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
          for (let i = 1; i < pathPoints.length; i++) {
            ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
          }
          ctx.strokeStyle = `${this.color}0.7)`;
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Draw active attack laser head
          const tip = pathPoints[pathPoints.length - 1];
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = `${this.color}1)`;
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0; // reset shadow
        }
      }
    }

    // ========================================================
    // Interactive mouse drag controls to rotate globe
    // ========================================================
    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;
    let autoRotateTimer = 0;

    window.addEventListener('mousedown', (e) => {
      // Ignore drags when clicking interactive text inputs, buttons, or navigation bars
      if (
        e.target.tagName !== 'BUTTON' && 
        e.target.tagName !== 'A' && 
        !e.target.closest('.carousel-container') && 
        !e.target.closest('.landing-nav')
      ) {
        isDragging = true;
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMouseX;
        const deltaY = e.clientY - previousMouseY;

        rotY += deltaX * 0.004; // rotate horizontally
        rotX += deltaY * 0.004; // rotate vertically

        // Clamp vertical tilt to avoid tumbling inside out
        if (rotX > 1.4) rotX = 1.4;
        if (rotX < -1.4) rotX = -1.4;

        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
        autoRotateTimer = 180; // stop auto rotation for 3 seconds after drag
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // ========================================================
    // Main Globe Animation Frame Loop
    // ========================================================
    function renderGlobeFrame() {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Auto-rotation handling
      if (!isDragging) {
        if (autoRotateTimer > 0) {
          autoRotateTimer--;
        } else {
          rotY += 0.0015; // Slow horizontal rotation
        }
      }

      // 1. Draw Fibonacci land/ocean dots
      points.forEach(pt => {
        const proj = project3DPoint(pt.lat, pt.lon, globeRadius);
        if (proj.visible) {
          // Darker/transparent points on the back side of hemisphere
          const depthAlpha = (proj.z + globeRadius) / (2 * globeRadius); // 0 to 1
          
          if (pt.isLand) {
            ctx.fillStyle = `rgba(0, 240, 255, ${0.15 + depthAlpha * 0.2})`;
            ctx.fillRect(proj.x - 1, proj.y - 1, 2, 2);
          } else {
            // Draw transparent grid placeholder dots for oceans
            ctx.fillStyle = `rgba(255, 255, 255, ${0.01 + depthAlpha * 0.03})`;
            ctx.fillRect(proj.x - 0.5, proj.y - 0.5, 1, 1);
          }
        }
      });

      // 2. Draw city nodes (targets/sources)
      cities.forEach(city => {
        const proj = project3DPoint(city.lat, city.lon, globeRadius);
        if (proj.visible) {
          const depthAlpha = (proj.z + globeRadius) / (2 * globeRadius);
          
          // Outer pulse ring
          const pulseSize = 3 + Math.sin(Date.now() * 0.004) * 2;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, pulseSize, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 240, 255, ${depthAlpha * 0.4})`;
          ctx.stroke();

          // Inner solid core node
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${depthAlpha})`;
          ctx.fill();

          // Draw city names labels if node is front-facing
          if (proj.z > globeRadius * 0.3) {
            ctx.fillStyle = `rgba(148, 163, 184, ${depthAlpha})`;
            ctx.font = '700 8px Inter';
            ctx.textAlign = 'left';
            ctx.fillText(city.name, proj.x + 6, proj.y + 3);
          }
        }
      });

      // 3. Update & Draw Attack Laser Arcs
      attacks.forEach((attack, idx) => {
        attack.update();
        attack.draw();
      });
      // Clean up completed attacks
      attacks = attacks.filter(a => a.progress < 1.0);

      // Randomly spawn new attacks
      if (attacks.length < 5 && Math.random() < 0.02) {
        attacks.push(new CyberAttack());
      }

      // 4. Update & Draw Explosions particle bursts
      explosions.forEach((exp, idx) => {
        exp.update();
        exp.draw();
      });
      // Clean up faded explosions
      explosions = explosions.filter(e => e.life > 0);

      requestAnimationFrame(renderGlobeFrame);
    }

    // Start Globe Rendering
    renderGlobeFrame();
  }

  // ========================================================
  // 2. SLIDESHOW CAROUSEL CONTROLLER
  // ========================================================
  const track = document.getElementById('carousel-track');
  if (track) {
    const slides = Array.from(track.children);
    const nextBtn = document.getElementById('carousel-next-btn');
    const prevBtn = document.getElementById('carousel-prev-btn');
    const dotsContainer = document.getElementById('carousel-dots-container');

    let currentIdx = 0;
    let slideInterval = null;

    // Create dot indicators
    slides.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.className = `carousel-dot ${idx === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => moveToSlide(idx));
      dotsContainer.appendChild(dot);
    });

    const dots = Array.from(dotsContainer.children);

    function updateDots() {
      dots.forEach((dot, idx) => {
        if (idx === currentIdx) dot.classList.add('active');
        else dot.classList.remove('active');
      });
    }

    function moveToSlide(index) {
      // De-activate old slide
      slides[currentIdx].classList.remove('active');
      
      // Calculate loop bounds
      currentIdx = (index + slides.length) % slides.length;
      
      // Activate new slide
      slides[currentIdx].classList.add('active');
      track.style.transform = `translateX(-${currentIdx * 100}%)`;
      
      updateDots();
      resetAutoSlide();
    }

    nextBtn.addEventListener('click', () => moveToSlide(currentIdx + 1));
    prevBtn.addEventListener('click', () => moveToSlide(currentIdx - 1));

    function startAutoSlide() {
      slideInterval = setInterval(() => {
        moveToSlide(currentIdx + 1);
      }, 6000);
    }

    function resetAutoSlide() {
      if (slideInterval) {
        clearInterval(slideInterval);
      }
      startAutoSlide();
    }

    // Initialize auto slide
    startAutoSlide();
  }
});
