/**
 * Hebcal loader — normalizes the @hebcal/core bundle global to window.Hebcal
 * so hebcal-adapter.js can use it without relying on the bundle's exact export name.
 * Run this script after the hebcal-core.min.js bundle.
 */
(function () {
  'use strict';
  if (typeof window.Hebcal !== 'undefined') return;
  if (typeof window.HebcalCore !== 'undefined') {
    window.Hebcal = window.HebcalCore;
    return;
  }
  if (typeof window.hebcal !== 'undefined') {
    window.Hebcal = window.hebcal;
    return;
  }
  if (typeof hebcal !== 'undefined') {
    window.Hebcal = hebcal;
    return;
  }
  if (typeof Hebcal !== 'undefined') {
    window.Hebcal = Hebcal;
    return;
  }
  window.Hebcal = {};
})();
