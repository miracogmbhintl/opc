import { TranslationProvider } from '../lib/TranslationContext';
import MirakaForgotPassword from './MirakaForgotPassword';

export default function ForgotPasswordWrapper() {
  return (
    <TranslationProvider>
      <MirakaForgotPassword />
    </TranslationProvider>
  );
}
