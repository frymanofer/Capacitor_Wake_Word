// Everything you may want to change in the car agent demo.

/** Temporary DaVoice demo license (all DaVoice libraries). Get a production key from info@davoice.io. */
export const DAVOICE_LICENSE_KEY = 'MTc5NjA3NjAwMDAwMA==-FmI0i6C8wjKqQwmvi/PAmUy9ayviOGvWhGLFGHZrg9I=';

/** Wake word: a .dm model in www/models (bundled with this app). */
export const WAKE_WORD_MODEL = 'models/hey_davoice_model_28_06042026.dm';
export const WAKE_WORD_LABEL = 'Hey DaVoice';
export const WAKE_WORD_THRESHOLD = 0.999;
export const WAKE_WORD_BUFFER_COUNT = 3;

/** Speaker verification model (www/models) and its match threshold. */
export const SV_MODEL = 'models/sv.dm';
export const SV_SAMPLE_COUNT = 5;

/** Languages offered first (the rest of the language packs are listed below them). */
export const FEATURED_LANGUAGES = ['en', 'pt-BR'];
