'use client';

/**
 * Every tool's component, each in its own chunk. Opening Split Bill loads Split
 * Bill, not the image compressor; the service worker still caches them all for
 * offline use.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  'text-cleaner': dynamic(() => import('./text/TextCleaner')),
  'case-converter': dynamic(() => import('./text/CaseConverter')),
  'word-counter': dynamic(() => import('./text/WordCounter')),
  'remove-duplicates': dynamic(() => import('./text/RemoveDuplicates')),
  'find-replace': dynamic(() => import('./text/FindReplace')),
  extractor: dynamic(() => import('./text/Extractor')),
  'text-sorter': dynamic(() => import('./text/TextSorter')),

  'image-compressor': dynamic(() => import('./image/ImageCompressor')),
  'image-resizer': dynamic(() => import('./image/ImageResizer')),
  'image-converter': dynamic(() => import('./image/ImageConverter')),
  'image-cropper': dynamic(() => import('./image/ImageCropper')),
  'image-to-pdf': dynamic(() => import('./image/ImageToPdf')),

  percentage: dynamic(() => import('./calculate/Percentage')),
  discount: dynamic(() => import('./calculate/Discount')),
  'split-bill': dynamic(() => import('./calculate/SplitBill')),
  tip: dynamic(() => import('./calculate/Tip')),
  gst: dynamic(() => import('./calculate/Gst')),
  emi: dynamic(() => import('./calculate/Emi')),
  age: dynamic(() => import('./calculate/Age')),

  'date-difference': dynamic(() => import('./time/DateDifference')),
  'days-until': dynamic(() => import('./time/DaysUntil')),
  'add-date': dynamic(() => import('./time/AddDate')),
  stopwatch: dynamic(() => import('./time/Stopwatch')),
  countdown: dynamic(() => import('./time/Countdown')),
  pomodoro: dynamic(() => import('./time/Pomodoro')),
  'time-difference': dynamic(() => import('./time/TimeDifference')),

  'unit-converter': dynamic(() => import('./measure/UnitConverter')),
  'data-size': dynamic(() => import('./measure/DataSize')),
  'aspect-ratio': dynamic(() => import('./measure/AspectRatio')),
  'golden-ratio': dynamic(() => import('./measure/GoldenRatio')),
  'grid-calculator': dynamic(() => import('./measure/GridCalculator')),
  'pixel-density': dynamic(() => import('./measure/PixelDensity')),

  receipt: dynamic(() => import('./document/Receipt')),
  invoice: dynamic(() => import('./document/Invoice')),
  'image-sheet': dynamic(() => import('./document/ImageSheet')),

  'qr-code': dynamic(() => import('./quick/QrCode')),
  password: dynamic(() => import('./quick/Password')),
  'random-number': dynamic(() => import('./quick/RandomNumber')),
  'random-picker': dynamic(() => import('./quick/RandomPicker')),
  dice: dynamic(() => import('./quick/Dice')),
  'coin-flip': dynamic(() => import('./quick/CoinFlip')),
  uuid: dynamic(() => import('./quick/Uuid')),
  'lorem-ipsum': dynamic(() => import('./quick/Lorem')),
};
