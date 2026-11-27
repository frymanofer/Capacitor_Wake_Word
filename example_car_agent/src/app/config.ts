// Everything you may want to change in the car agent demo.

/** Temporary DaVoice demo license (all DaVoice libraries). Get a production key from info@davoice.io. */
export const DAVOICE_LICENSE_KEY = 'DV2.eyJ2IjoyLCJraWQiOiJrMSIsImlkIjoiNmJlNzkyZThlZjQ2IiwiY3VzdCI6IkRhVm9pY2UgZGVtbyBhcHAgQ2FwYWNpdG9yX1dha2VfV29yZC9leGFtcGxlX2Nhcl9hZ2VudCAoZXhhY3QgYXBwIGlkcyBvbmx5KSIsImlhdCI6MTc5NTcxMTA3NjM3MSwiZXhwIjoxODMwMjk3NjAwMDAwLCJwcm9kIjpbIioiXSwicGxhdCI6WyJhbmRyb2lkIiwiaW9zIl0sImFwcHMiOnsiYW5kcm9pZCI6WyJpby5kYXZvaWNlLmNhcmFnZW50LmNhcGFjaXRvciJdLCJpb3MiOlsiaW8uZGF2b2ljZS5jYXJhZ2VudC5jYXBhY2l0b3IiXX0sIm1vZGVscyI6WyJ0dHMvKiIsInd3LyoiXX0.BVnK4LAGldjlYyjGO6EKPzA2H0lGXTqJq5V8fE9Mio6OMAlgdeq6MrXA0lJlT0RNhI2qXKwLTfcqrYNuMRvd6w';

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
