/**
 * Tickets Page Wrapper
 * Wraps TicketsPageTranslated with TranslationProvider
 */

import { TranslationProvider } from '../lib/TranslationContext';
import TicketsPageTranslated from './TicketsPageTranslated';

export default function TicketsPageWrapper() {
  return (
    <TranslationProvider>
      <TicketsPageTranslated />
    </TranslationProvider>
  );
}
