// Update document <head> meta tags without react-helmet dependency.
// Works with Google's JS-rendered SPA crawling.

export const SITE_NAME = 'ExamSarkar';
export const SITE_URL = 'https://www.examsarkar.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

const DEFAULT = {
  title: `${SITE_NAME} – Free UPSC & Government Exam Mock Tests Online`,
  description:
    'Prepare for UPSC, IAS, SSC, and all government exams with ExamSarkar. Get free daily quizzes, full-length mock tests, detailed solutions, and performance analytics to crack your exam.',
  url: `${SITE_URL}/`,
  image: DEFAULT_OG_IMAGE,
  type: 'website',
  noindex: false,
};

const upsertMeta = (selector, attrName, attrValue, contentValue) => {
  try {
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', contentValue);
  } catch (_) {}
};

const upsertLink = (rel, href) => {
  try {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  } catch (_) {}
};

export const updateSEO = (opts = {}) => {
  const {
    title = DEFAULT.title,
    description = DEFAULT.description,
    url = DEFAULT.url,
    image = DEFAULT.image,
    type = DEFAULT.type,
    noindex = DEFAULT.noindex,
  } = opts;

  const fullTitle =
    title === DEFAULT.title ? title : `${title} | ${SITE_NAME}`;

  try {
    document.title = fullTitle;
  } catch (_) {}

  upsertMeta('meta[name="title"]', 'name', 'title', fullTitle);
  upsertMeta('meta[name="description"]', 'name', 'description', description);
  upsertMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    noindex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );

  upsertLink('canonical', url);

  upsertMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);
  upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
  upsertMeta('meta[property="og:type"]', 'property', 'og:type', type);
  upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);

  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
};

export const resetSEO = () => updateSEO(DEFAULT);
