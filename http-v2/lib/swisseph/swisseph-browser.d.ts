/**
 * Swiss Ephemeris for Browsers (WebAssembly) - Modern TypeScript API
 *
 * High-precision astronomical calculations in the browser using WebAssembly.
 * This module provides the same modern API as the Node.js version but runs
 * entirely in the browser with no server required.
 */
import { CalendarType, CelestialBody, HouseSystem, CalculationFlagInput, EclipseTypeFlagInput, PlanetaryPosition, HouseData, LunarEclipse, SolarEclipse, ExtendedDateTime } from '@swisseph/core';
/**
 * Swiss Ephemeris for browsers
 *
 * This class provides access to Swiss Ephemeris calculations in the browser
 * using WebAssembly. It must be initialized before use.
 *
 * @example
 * import { SwissEphemeris, Planet, CalculationFlag } from './swisseph-browser.js';
 *
 * const swe = new SwissEphemeris();
 * await swe.init();
 *
 * const jd = swe.julianDay(2007, 3, 3);
 * const sun = swe.calculatePosition(jd, Planet.Sun);
 * console.log(`Sun: ${sun.longitude}°`);
 */
export declare class SwissEphemeris {
    private module;
    private ready;
    private _julday;
    private _getPlanetName;
    private _close;
    private _version;
    /**
     * Initialize the WebAssembly module
     *
     * This must be called before using any other methods.
     * The WASM file is automatically loaded from the same directory as the JS bundle.
     *
     * @param wasmPath - Optional custom path to swisseph.wasm file (for advanced use cases)
     *
     * @example
     * const swe = new SwissEphemeris();
     * await swe.init();
     * console.log(swe.version());
     */
    init(wasmPath?: string): Promise<void>;
    /**
     * Wrap C functions for easier calling
     */
    private _wrapFunctions;
    /**
     * Check if the module is ready for use
     * @throws Error if not initialized
     */
    private _checkReady;
    /**
     * Get Swiss Ephemeris version string
     */
    version(): string;
    /**
     * Set ephemeris file path
     *
     * Note: This is typically not used in the browser version as we use
     * the built-in Moshier ephemeris.
     *
     * @param path - Path to ephemeris files
     */
    setEphemerisPath(path: string): void;
    /**
     * Load standard Swiss Ephemeris data files from jsDelivr CDN
     *
     * Simple one-line method to download standard ephemeris files (~2MB).
     * After loading, you can use CalculationFlag.SwissEphemeris for maximum precision.
     *
     * @example
     * // Simple: Load all standard files
     * await swe.loadStandardEphemeris();
     *
     * // Then use Swiss Ephemeris for calculations
     * const sun = swe.calculatePosition(jd, Planet.Sun, CalculationFlag.SwissEphemeris);
     */
    loadStandardEphemeris(): Promise<void>;
    /**
     * Load Swiss Ephemeris data files from URLs
     *
     * Downloads ephemeris files and writes them to the virtual filesystem.
     * Use this for maximum precision calculations or custom file sources.
     *
     * @param files - Array of files to download with name and URL
     *
     * @example
     * // Load from custom CDN or server
     * await swe.loadEphemerisFiles([
     *   {
     *     name: 'sepl_18.se1',
     *     url: 'https://your-cdn.com/ephemeris/sepl_18.se1'
     *   },
     *   {
     *     name: 'semo_18.se1',
     *     url: 'https://your-cdn.com/ephemeris/semo_18.se1'
     *   }
     * ]);
     *
     * // Then use Swiss Ephemeris
     * const sun = swe.calculatePosition(jd, Planet.Sun, CalculationFlag.SwissEphemeris);
     */
    loadEphemerisFiles(files: Array<{
        name: string;
        url: string;
    }>): Promise<void>;
    /**
     * Calculate Julian day number from calendar date
     *
     * @param year - Year (negative for BCE)
     * @param month - Month (1-12)
     * @param day - Day (1-31)
     * @param hour - Hour as decimal (0.0-23.999...)
     * @param calendarType - Calendar system (default: Gregorian)
     * @returns Julian day number
     *
     * @example
     * const jd = swe.julianDay(2007, 3, 3);
     * console.log(jd); // 2454162.5
     */
    julianDay(year: number, month: number, day: number, hour?: number, calendarType?: CalendarType): number;
    /**
     * Calculate Julian day number from a JavaScript Date object
     *
     * Convenience function that converts a JavaScript Date to Julian day number.
     * The Date is interpreted as UTC.
     *
     * @param date - JavaScript Date object (interpreted as UTC)
     * @param calendarType - Calendar system (default: Gregorian)
     * @returns Julian day number
     *
     * @example
     * // From Date object
     * const date = new Date('1990-05-15T14:30:00Z');
     * const jd = swe.dateToJulianDay(date);
     *
     * // From timestamp
     * const now = new Date();
     * const jdNow = swe.dateToJulianDay(now);
     *
     * // Equivalent to swe.julianDay(1990, 5, 15, 14.5)
     * const jd2 = swe.dateToJulianDay(new Date(Date.UTC(1990, 4, 15, 14, 30)));
     */
    dateToJulianDay(date: Date, calendarType?: CalendarType): number;
    /**
     * Convert Julian day number to calendar date
     *
     * @param jd - Julian day number
     * @param calendarType - Calendar system (default: Gregorian)
     * @returns DateTime object
     *
     * @example
     * const date = swe.julianDayToDate(2454162.5);
     * console.log(date.toString());
     */
    julianDayToDate(jd: number, calendarType?: CalendarType): ExtendedDateTime;
    /**
     * Calculate planetary positions
     *
     * Note: Browser version uses Moshier ephemeris by default.
     *
     * @param julianDay - Julian day number in Universal Time
     * @param body - Celestial body to calculate
     * @param flags - Calculation flags (default: Moshier with speed)
     * @returns PlanetaryPosition object
     *
     * @example
     * const sun = swe.calculatePosition(jd, Planet.Sun);
     * console.log(`Sun: ${sun.longitude}°, ${sun.latitude}°`);
     *
     * const moon = swe.calculatePosition(
     *   jd,
     *   Planet.Moon,
     *   CalculationFlag.MoshierEphemeris | CalculationFlag.Speed
     * );
     */
    calculatePosition(julianDay: number, body: CelestialBody, flags?: CalculationFlagInput): PlanetaryPosition;
    /**
     * Get celestial body name
     *
     * @param body - Celestial body identifier
     * @returns Name as a string
     *
     * @example
     * const name = swe.getCelestialBodyName(Planet.Mars);
     * console.log(name); // "Mars"
     */
    getCelestialBodyName(body: CelestialBody): string;
    /**
     * Find next lunar eclipse
     *
     * @param startJulianDay - Julian day to start search from
     * @param flags - Calculation flags (default: Moshier)
     * @param eclipseType - Filter by eclipse type (0 = all types)
     * @param backward - Search backward in time if true
     * @returns LunarEclipse object
     *
     * @example
     * const eclipse = swe.findNextLunarEclipse(jd);
     * console.log(`Is total: ${eclipse.isTotal()}`);
     * console.log(`Duration: ${eclipse.getTotalityDuration()} hours`);
     */
    findNextLunarEclipse(startJulianDay: number, flags?: CalculationFlagInput, eclipseType?: EclipseTypeFlagInput, backward?: boolean): LunarEclipse;
    /**
     * Find next solar eclipse globally
     *
     * @param startJulianDay - Julian day to start search from
     * @param flags - Calculation flags (default: Moshier)
     * @param eclipseType - Filter by eclipse type (0 = all types)
     * @param backward - Search backward in time if true
     * @returns SolarEclipse object
     *
     * @example
     * const eclipse = swe.findNextSolarEclipse(jd);
     * console.log(`Is total: ${eclipse.isTotal()}`);
     * console.log(`Is central: ${eclipse.isCentral()}`);
     */
    findNextSolarEclipse(startJulianDay: number, flags?: CalculationFlagInput, eclipseType?: EclipseTypeFlagInput, backward?: boolean): SolarEclipse;
    /**
     * Calculate house cusps and angles
     *
     * @param julianDay - Julian day number in Universal Time
     * @param latitude - Geographic latitude
     * @param longitude - Geographic longitude
     * @param houseSystem - House system (default: Placidus)
     * @returns HouseData object
     *
     * @example
     * const houses = swe.calculateHouses(jd, 40.7128, -74.0060);
     * console.log(`Ascendant: ${houses.ascendant}°`);
     * console.log(`MC: ${houses.mc}°`);
     */
    calculateHouses(julianDay: number, latitude: number, longitude: number, houseSystem?: HouseSystem): HouseData;
    /**
     * Close Swiss Ephemeris and free resources
     */
    close(): void;
}
export * from '@swisseph/core';
export declare const swisseph: SwissEphemeris;
export default SwissEphemeris;
declare global {
    interface Window {
        SwissEphemeris?: typeof SwissEphemeris;
        swisseph?: SwissEphemeris;
    }
}
//# sourceMappingURL=swisseph-browser.d.ts.map