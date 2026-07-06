document.addEventListener('DOMContentLoaded', function () {

  var menuToggle = document.getElementById('menu-toggle');
  var mainNav = document.getElementById('main-nav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', function () {
      var open = mainNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none)').matches;

  var shelfWrap = document.getElementById('shelf-wrap');
  var shelfRoom = document.getElementById('shelf-room');
  var shelfTag = document.getElementById('shelf-tag');

  if (shelfWrap && shelfRoom && !reduceMotion && !isTouch) {
    shelfWrap.addEventListener('mousemove', function (e) {
      var rect = shelfWrap.getBoundingClientRect();
      var relX = (e.clientX - rect.left) / rect.width - 0.5;
      var relY = (e.clientY - rect.top) / rect.height - 0.5;
      var rotY = -12 + relX * 24;
      var rotX = 8 - relY * 16;
      shelfRoom.style.transform = 'rotateX(' + rotX.toFixed(1) + 'deg) rotateY(' + rotY.toFixed(1) + 'deg)';
    });
    shelfWrap.addEventListener('mouseleave', function () {
      shelfRoom.style.transform = 'rotateX(8deg) rotateY(-12deg)';
      if (shelfTag) shelfTag.style.opacity = '0';
    });
  }

  var shelfItems = document.querySelectorAll('.shelf-item');
  shelfItems.forEach(function (item) {
    function showTag() {
      if (!shelfTag) return;
      shelfTag.textContent = item.getAttribute('data-label');
      shelfTag.style.left = item.style.getPropertyValue('--x');
      var topVal = item.style.getPropertyValue('--y');
      shelfTag.style.top = 'calc(' + topVal + ' - 32px)';
      shelfTag.style.opacity = '1';
    }
    item.addEventListener('mouseenter', showTag);
    item.addEventListener('focus', showTag);
  });

  var dealsRow = document.getElementById('deals-row');
  var dealsPrev = document.getElementById('deals-prev');
  var dealsNext = document.getElementById('deals-next');
  if (dealsRow && dealsPrev && dealsNext) {
    dealsPrev.addEventListener('click', function () { dealsRow.scrollBy({ left: -240, behavior: 'smooth' }); });
    dealsNext.addEventListener('click', function () { dealsRow.scrollBy({ left: 240, behavior: 'smooth' }); });
  }

});
