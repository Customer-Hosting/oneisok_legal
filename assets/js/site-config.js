/* ==========================================================================
   SITE CONFIG — every business detail lives here.
   Change contact details in ONE place; header, footer, forms and
   JSON-LD schema all read from this object.
   ========================================================================== */

window.SITE = {
  name: "OneisOk Legal Consultancy",
  shortName: "OneisOk Legal",
  tagline: "Clear counsel. Decisive action.",
  legalName: "OneisOk Legal Consultancy",

  /* --- Contact --- */
  phone: "+919331222555",
  phoneDisplay: "+91 93312 22555",
  whatsapp: "919331222555",
  email: "info@legal.oneisok.co",
  emailAlt: "oneisokindia@gmail.com",

  /* --- Address --- */
  address: {
    street: "141/1B Lenin Sarani",
    locality: "Kolkata",
    region: "West Bengal",
    postalCode: "700013",
    country: "IN",
    countryName: "India"
  },
  mapQuery: "141/1B Lenin Sarani, Kolkata 700013",

  hours: [
    { days: "Monday – Friday", time: "10:00 AM – 7:00 PM" },
    { days: "Saturday",        time: "10:00 AM – 4:00 PM" },
    { days: "Sunday",          time: "Emergency consultations only" }
  ],

  /* --- Social --- */
  social: {
    facebook:  "https://www.facebook.com/",
    linkedin:  "https://www.linkedin.com/",
    instagram: "https://www.instagram.com/",
    twitter:   "https://twitter.com/"
  },

  /* --- Trust metrics --- */
  stats: [
    { value: 1000, suffix: "+", label: "Matters resolved" },
    { value: 10000, suffix: "+", label: "Clients advised" },
    { value: 33,   suffix: "+", label: "States served" },
    { value: 18,   suffix: "+", label: "Years of practice" }
  ],

  /* --- Forms ---
     Static hosting has no backend, so submissions open a prefilled
     WhatsApp thread (primary) or mail client (fallback).
     To switch to a hosted form service later, set `endpoint` to its URL
     and the form module will POST to it instead. */
  form: {
    mode: "whatsapp",
    endpoint: ""
  }
};
