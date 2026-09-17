/**
 * One converter for everything measurable.
 *
 * Each unit is a factor to its category's base unit — metres, kilograms, litres
 * — except temperature, which has offsets. Factors are the exact defined values
 * (an inch is exactly 25.4 mm, a pound exactly 0.45359237 kg), so conversions
 * are as accurate as floating point allows, and rounding happens only on screen.
 *
 * `parseQuantity` reads how people write measurements: "5 ft 10 in", "5'10\"",
 * "72 kg", "98.6°F".
 */

export type UnitCategory = 'length' | 'weight' | 'temperature' | 'area' | 'volume' | 'speed' | 'data' | 'energy' | 'pressure';

export interface Unit {
  id: string;
  label: string;
  symbol: string;
  /** Multiply by this to reach the base unit. Unused for temperature. */
  factor: number;
  aliases: string[];
}

const u = (id: string, label: string, symbol: string, factor: number, ...aliases: string[]): Unit => ({ id, label, symbol, factor, aliases: [id, symbol.toLowerCase(), label.toLowerCase(), ...aliases] });

export const CATEGORIES: { id: UnitCategory; label: string; units: Unit[]; defaults: [string, string] }[] = [
  { id: 'length', label: 'Length', defaults: ['ft', 'cm'], units: [
    u('mm', 'Millimetres', 'mm', 0.001, 'millimetre', 'millimeter', 'millimeters'),
    u('cm', 'Centimetres', 'cm', 0.01, 'centimetre', 'centimeter', 'centimeters', 'cms'),
    u('m', 'Metres', 'm', 1, 'metre', 'meter', 'meters', 'mtr'),
    u('km', 'Kilometres', 'km', 1000, 'kilometre', 'kilometer', 'kilometers', 'kms'),
    u('in', 'Inches', 'in', 0.0254, 'inch', '"', '″'),
    u('ft', 'Feet', 'ft', 0.3048, 'foot', "'", '′'),
    u('yd', 'Yards', 'yd', 0.9144, 'yard', 'yds'),
    u('mi', 'Miles', 'mi', 1609.344, 'mile'),
    u('nmi', 'Nautical miles', 'nmi', 1852, 'nautical mile'),
  ] },
  { id: 'weight', label: 'Weight', defaults: ['kg', 'lb'], units: [
    u('mg', 'Milligrams', 'mg', 1e-6, 'milligram'),
    u('g', 'Grams', 'g', 1e-3, 'gram', 'gm', 'gms'),
    u('kg', 'Kilograms', 'kg', 1, 'kilogram', 'kilo', 'kilos', 'kgs'),
    u('t', 'Tonnes', 't', 1000, 'tonne', 'ton', 'tons', 'metric ton'),
    u('oz', 'Ounces', 'oz', 0.028349523125, 'ounce'),
    u('lb', 'Pounds', 'lb', 0.45359237, 'pound', 'lbs'),
    u('st', 'Stone', 'st', 6.35029318, 'stones'),
  ] },
  { id: 'temperature', label: 'Temperature', defaults: ['c', 'f'], units: [
    u('c', 'Celsius', '°C', 1, 'celsius', 'centigrade', '°c', 'degc', 'degrees celsius'),
    u('f', 'Fahrenheit', '°F', 1, 'fahrenheit', '°f', 'degf', 'degrees fahrenheit'),
    u('k', 'Kelvin', 'K', 1, 'kelvin', 'kelvins'),
  ] },
  { id: 'area', label: 'Area', defaults: ['sqft', 'sqm'], units: [
    u('sqcm', 'Square centimetres', 'cm²', 1e-4, 'cm2', 'sq cm', 'square centimeters'),
    u('sqm', 'Square metres', 'm²', 1, 'm2', 'sq m', 'sqmt', 'square meters', 'square metre'),
    u('ha', 'Hectares', 'ha', 1e4, 'hectare'),
    u('sqkm', 'Square kilometres', 'km²', 1e6, 'km2', 'sq km', 'square kilometers'),
    u('sqin', 'Square inches', 'in²', 0.00064516, 'in2', 'sq in', 'square inch'),
    u('sqft', 'Square feet', 'ft²', 0.09290304, 'ft2', 'sq ft', 'sqft', 'square foot'),
    u('sqyd', 'Square yards', 'yd²', 0.83612736, 'yd2', 'sq yd', 'gaj', 'square yard'),
    u('acre', 'Acres', 'ac', 4046.8564224, 'acres'),
    u('sqmi', 'Square miles', 'mi²', 2589988.110336, 'mi2', 'sq mi', 'square mile'),
  ] },
  { id: 'volume', label: 'Volume', defaults: ['l', 'gal'], units: [
    u('ml', 'Millilitres', 'ml', 0.001, 'millilitre', 'milliliter', 'milliliters', 'mL'),
    u('l', 'Litres', 'L', 1, 'litre', 'liter', 'liters', 'ltr'),
    u('m3', 'Cubic metres', 'm³', 1000, 'cubic meter', 'cubic metre', 'cbm'),
    u('tsp', 'Teaspoons (US)', 'tsp', 0.00492892159375, 'teaspoon', 'teaspoons'),
    u('tbsp', 'Tablespoons (US)', 'tbsp', 0.01478676478125, 'tablespoon', 'tablespoons'),
    u('floz', 'Fluid ounces (US)', 'fl oz', 0.0295735295625, 'fluid ounce', 'fluid ounces'),
    u('cup', 'Cups (US)', 'cup', 0.2365882365, 'cups'),
    u('pt', 'Pints (US)', 'pt', 0.473176473, 'pint', 'pints'),
    u('gal', 'Gallons (US)', 'gal', 3.785411784, 'gallon', 'gallons', 'us gallon'),
    u('ukgal', 'Gallons (UK)', 'UK gal', 4.54609, 'imperial gallon', 'uk gallon'),
    u('ft3', 'Cubic feet', 'ft³', 28.316846592, 'cubic foot', 'cubic feet', 'cu ft'),
  ] },
  { id: 'speed', label: 'Speed', defaults: ['kmh', 'mph'], units: [
    u('ms', 'Metres per second', 'm/s', 1, 'mps', 'meters per second'),
    u('kmh', 'Kilometres per hour', 'km/h', 1 / 3.6, 'kph', 'kmph', 'kilometers per hour'),
    u('mph', 'Miles per hour', 'mph', 0.44704, 'mi/h', 'miles per hour'),
    u('kn', 'Knots', 'kn', 1852 / 3600, 'knot', 'knots', 'kt'),
    u('fts', 'Feet per second', 'ft/s', 0.3048, 'fps'),
  ] },
  { id: 'data', label: 'Data', defaults: ['mb', 'gb'], units: [
    u('bit', 'Bits', 'bit', 1 / 8, 'bits'),
    u('b', 'Bytes', 'B', 1, 'byte', 'bytes'),
    u('kb', 'Kilobytes', 'KB', 1e3, 'kilobyte', 'kilobytes'),
    u('mb', 'Megabytes', 'MB', 1e6, 'megabyte', 'megabytes'),
    u('gb', 'Gigabytes', 'GB', 1e9, 'gigabyte', 'gigabytes', 'gig', 'gigs'),
    u('tb', 'Terabytes', 'TB', 1e12, 'terabyte', 'terabytes'),
    u('kib', 'Kibibytes', 'KiB', 1024, 'kibibyte'),
    u('mib', 'Mebibytes', 'MiB', 1024 ** 2, 'mebibyte'),
    u('gib', 'Gibibytes', 'GiB', 1024 ** 3, 'gibibyte'),
    u('tib', 'Tebibytes', 'TiB', 1024 ** 4, 'tebibyte'),
  ] },
  { id: 'energy', label: 'Energy', defaults: ['kcal', 'kj'], units: [
    u('j', 'Joules', 'J', 1, 'joule'),
    u('kj', 'Kilojoules', 'kJ', 1e3, 'kilojoule'),
    u('cal', 'Calories', 'cal', 4.184, 'calorie', 'small calorie'),
    u('kcal', 'Kilocalories', 'kcal', 4184, 'kilocalorie', 'food calorie', 'calories (food)'),
    u('wh', 'Watt-hours', 'Wh', 3600, 'watt hour', 'watt-hour'),
    u('kwh', 'Kilowatt-hours', 'kWh', 3.6e6, 'kilowatt hour', 'unit', 'units'),
    u('btu', 'BTU', 'BTU', 1055.05585262, 'btus'),
  ] },
  { id: 'pressure', label: 'Pressure', defaults: ['psi', 'bar'], units: [
    u('pa', 'Pascals', 'Pa', 1, 'pascal'),
    u('kpa', 'Kilopascals', 'kPa', 1e3, 'kilopascal'),
    u('bar', 'Bar', 'bar', 1e5, 'bars'),
    u('atm', 'Atmospheres', 'atm', 101325, 'atmosphere'),
    u('psi', 'Pounds per square inch', 'psi', 6894.757293168361, 'pound per square inch'),
    u('mmhg', 'Millimetres of mercury', 'mmHg', 133.322387415, 'mm hg', 'torr'),
  ] },
];

export function categoryOf(id: UnitCategory) {
  return CATEGORIES.find((c) => c.id === id)!;
}

export function findUnit(word: string): { unit: Unit; category: UnitCategory } | null {
  const w = word.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
  if (!w) return null;
  // Exact matches first, so "m" is metres and not the start of "miles".
  for (const cat of CATEGORIES) for (const unit of cat.units) if (unit.aliases.includes(w)) return { unit, category: cat.id };
  // Plural forms of aliases: "inches", "metres".
  const singular = w.replace(/(es|s)$/, '');
  for (const cat of CATEGORIES) for (const unit of cat.units) if (unit.aliases.includes(singular)) return { unit, category: cat.id };
  return null;
}

function toBase(value: number, category: UnitCategory, unit: Unit): number {
  if (category !== 'temperature') return value * unit.factor;
  if (unit.id === 'c') return value;
  if (unit.id === 'f') return (value - 32) * (5 / 9);
  return value - 273.15;
}

function fromBase(value: number, category: UnitCategory, unit: Unit): number {
  if (category !== 'temperature') return value / unit.factor;
  if (unit.id === 'c') return value;
  if (unit.id === 'f') return value * (9 / 5) + 32;
  return value + 273.15;
}

export function convert(value: number, category: UnitCategory, from: string, to: string): number | null {
  const cat = categoryOf(category);
  const a = cat.units.find((x) => x.id === from);
  const b = cat.units.find((x) => x.id === to);
  if (!a || !b) return null;
  return fromBase(toBase(value, category, a), category, b);
}

export interface Quantity { category: UnitCategory; unit: Unit; value: number; base: number }

/**
 * "5 ft 10 in" → 5.8333 ft. Parts in the same category add up, expressed in
 * the first unit; a unit from another category makes it unreadable.
 */
export function parseQuantity(text: string): Quantity | null {
  let t = text.trim().toLowerCase().replace(/,/g, '');
  // 5'10" and 5′10″
  t = t.replace(/(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)\s*(?:["″]|in\b)?/g, '$1 ft $2 in');
  t = t.replace(/(\d)\s*(['′])(?!\s*\d)/g, '$1 ft').replace(/(\d)\s*(["″])/g, '$1 in');
  t = t.replace(/°\s*([cf])\b/g, ' °$1').replace(/degrees?\s+(celsius|fahrenheit|c|f)\b/g, '°$1');
  const parts = [...t.matchAll(/(-?\d*\.?\d+)\s*([a-z°"'′″][a-z0-9°²³/ .]*?)(?=\s*-?\d|\s*$|\s+and\s)/g)];
  if (!parts.length) return null;
  let category: UnitCategory | null = null;
  let first: Unit | null = null;
  let base = 0;
  let consumed = '';
  for (const part of parts) {
    const found = findUnit(part[2]);
    if (!found) return null;
    if (category && found.category !== category) return null;
    category = found.category;
    first ??= found.unit;
    base += toBase(Number(part[1]), found.category, found.unit);
    consumed += part[0];
  }
  // Anything left over that isn't a number or unit means this wasn't a measurement.
  const rest = t.replace(/\band\b/g, ' ');
  if (rest.replace(/\s+/g, '').length > consumed.replace(/\s+/g, '').length + 1) return null;
  if (!category || !first) return null;
  if (category === 'temperature' && parts.length > 1) return null;
  return { category, unit: first, value: fromBase(base, category, first), base };
}

/**
 * "5 feet 10 inches in cm", "100 f to c", "2 gb in mb" → the quantity and the
 * unit wanted. "in" is both a unit and a word, so the target is only taken
 * from the end.
 */
export function parseConversion(text: string): { quantity: Quantity; to: Unit; result: number } | null {
  const t = text.trim().replace(/\?$/, '');
  // The trailing space is a lookahead, so "12 in in cm" finds both separators.
  const separators = [...t.matchAll(/\s+(?:to|in|into|as|=)(?=\s)/gi)].reverse();
  // From the last separator back: in "12 in in cm" the target follows the second "in".
  for (const sep of separators) {
    const quantity = parseQuantity(t.slice(0, sep.index));
    const target = findUnit(t.slice(sep.index! + sep[0].length).trim().replace(/^(?:a |an )/i, ''));
    if (!quantity || !target || target.category !== quantity.category) continue;
    const result = convert(quantity.value, quantity.category, quantity.unit.id, target.unit.id);
    if (result !== null) return { quantity, to: target.unit, result };
  }
  return null;
}

/** Feet and inches, the way heights are said: 5 ft 10 in. */
export function feetInches(metres: number): string {
  const totalInches = metres / 0.0254;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round((totalInches - feet * 12) * 10) / 10;
  if (inches >= 12) { feet += 1; inches -= 12; }
  return `${feet} ft ${inches} in`;
}
