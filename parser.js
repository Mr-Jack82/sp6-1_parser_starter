/**
 * Currency symbol mapping to their code.
 */
const CURRENCY_MAP = {
  "$": "USD",
  "€": "EUR",
  "₽": "RUB",
};

/**
 * Determines the currency code from a text string.
 * Return RUB by default, if symbol does not found
 * @param {string} text - Text containing the price (example, "₽50" or "$100").
 * @returns {string} Currency code (USD, EUR, RUB).
 */

function getCurrencyCode(text) {
  // Search the first symbol from map
  for (const [symbol, code] of Object.entries(CURRENCY_MAP)) {
    if (text.includes(symbol)) {
      return code;
    }
  }
  // Default value
  return "RUB";
}

/**
 * Trim a string to the first dash of any type (hyphen, en dash, em dash)
 * If dash does not exists - return the original string
 * @param {string|null|undefined} str - Original string
 * @returns {string} Trimmed string
 */
function truncateToDash(str) {
  if (!str) return "";
  const match = String(str).match(/^[^-—–]+/);
  return match ? match[0].trim() : String(str).trim();
}

/**
 * Formats the date in the format DD.MM.YYYY.
 * Supports: empty string, ISO-string already partially formatted date.
 * On error, returns an empty string (without crashing the code)
 * @param {string|null|undefined} dateStr - Original date
 * @returns {string} Dates in format DD.MM.YYYY or empty string.
 */
function formatDateToDDMMYYYY(dateStr) {
  if (!dateStr) return "";

  const raw = String(dateStr).trim();
  // Leave only numbers and separators, then split by any non-numeric character
  const parts = raw.replace(/[^\d\/\-\.]/g, '').split(/[\/\-\.]+/);

  // We need exactly 3 parts: day, month, year
  if (parts.length !== 3) return "";

  let [day, month, year] = parts;

  // In case there is something empty somewhere
  if (!day || !month || !year) return "";

  // Add a leading zero if needed and limit the length to protect against debris.
  day = day.padStart(2, "0").slice(0, 2);
  month = month.padStart(2, "0").slice(0, 2);
  year = year.slice(-4);  // the last 4 digits of the year

  return `${day}.${month}.${year}`;
}

/**
 * Removes all attributes from all tags in an HTML string
 * Saves structure an content.
 * @param {string} html - Original HTML.
 * @returns {string} HTML without attributes.
 */
function stripAttributesFromHtml(html) {
  if (!html) return "";

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Recursively go through all the elements and remove attributes
  const walk = (node) => {
    if (node.nodeType === 1) {  // Node.ELEMENT_NODE
      while (node.attributes.length) {
        node.removeAttribute(node.attributes[0].name);
      }
      node.childNodes.forEach(walk);
    }
  };

  walk(tempDiv);

  return tempDiv.innerHTML.trim();
}

/**
 * Main page parse function
 * Returns an object strictly according to the required structure.
 */
function parsePage() {
    const result = {
        meta: {},
        product: {},
        suggested: [],
        reviews: []
    };

    const head = document.head;

    // --- 1. META DATA ---
    let titleText = (document
      .querySelector("title")
      ?.textContent
      || document
      .title)
      .trim();
    const match = titleText.match(/^[^\-—–]+/);
    result.meta.title = truncateToDash(titleText);

    result.meta.language = document.documentElement.getAttribute("lang") || "en";

    const descriptionMeta = head.querySelector("meta[name='description']");
    result.meta.description = descriptionMeta
      ? descriptionMeta.getAttribute("content")
      : "";

    const keywordsMeta = head.querySelector("meta[name='keywords']");
    if (keywordsMeta) {
      const content = keywordsMeta.getAttribute("content");
      // Split by comma and clean white spaces, remove empty lines
      result.meta.keywords = content
        .split(",")
        .map(k => k.trim())
        .filter(k => k !== "");
    } else {
      result.meta.keywords = [];
    }

    result.meta.opengraph = {
      title: truncateToDash(
        head.querySelector("meta[property='og:title']")?.getAttribute("content")
      ),
      image: head.querySelector("meta[property='og:image']")?.getAttribute("content"),
      type: head.querySelector("meta[property='og:type']")?.getAttribute("content")
    };

    // --- 2. PRODUCT DATA ---
    const productSection = document.querySelector('section.product');
    if (productSection) {
      const id = productSection.getAttribute("data-id");
      const nameEl = productSection.querySelector(".about .title");

      // Tags: color distribution logic (green/blue/red)
      const tagsContainer = productSection.querySelector(".tags");
      const tagsData = { category: [], discount: [], label: [] };
      if (tagsContainer) {
        tagsContainer.querySelectorAll("span").forEach(span => {
          const text = span.textContent.trim();
          if (span.classList.contains("green")) tagsData.category.push(text);
          else if (span.classList.contains("red")) tagsData.discount.push(text);
          else if (span.classList.contains("blue")) tagsData.label.push(text);
        });
      }

      // New price and old price
      const priceContainer = productSection.querySelector(".price");
      let price = 0;
      let oldPrice = 0;
      let currency = "RUB";   // Default value in case of error

      if (priceContainer) {
        // We take the first text node as the current price
        const priceTextRaw = priceContainer.firstChild?.nodeValue?.trim() || "";

        // Extracting a number value
        const priceMatch = priceTextRaw.replace(/[^0-9]/g, "");
        price = parseInt ? parseInt(priceMatch, 10) : 0;

        // Determining the currency
        currency = getCurrencyCode(priceTextRaw);

        // We search the old price in <span> tag inside .price
        const oldPriceEl = priceContainer.querySelector("span");
        const oldPriceText = oldPriceEl?.textContent?.trim() || "";
        const oldPriceMatch = oldPriceText.replace(/[^0-9]/g, "");
        oldPrice = oldPriceMatch ? parseInt(oldPriceMatch, 10) : price;
      }

      const discount = oldPrice - price;
      const discountPercent = oldPrice > 0
        ? ((discount / oldPrice) * 100).toFixed(2) + "%"
        : "0%";

      // Key/value properties
      const propertiesObj = {};
      productSection.querySelectorAll(".properties li").forEach(li => {
        const keyEl = li.querySelector("span:first-child");
        const valEl = li.querySelector("span:last-child");
        if (keyEl && valEl) {
          propertiesObj[keyEl.textContent.trim()] = valEl.textContent.trim();
        }
      });

      // Description (saving HTML as a string)
      const descContainer = productSection.querySelector(".description");
      let descriptionHtml = "";
      if (descContainer) {
        descriptionHtml = stripAttributesFromHtml(descContainer.innerHTML);
      }

      // Image (slider)
      const images = [];
      const navSlides = productSection.querySelector(".preview nav");
      if (navSlides) {
        navSlides.querySelectorAll("button img").forEach(img => {
          images.push({
            preview: img.getAttribute("src"),
            full: img.getAttribute("data-src"),
            alt: img.getAttribute("alt")
          });
        });
      }
      // Add main image, if it doesn't exists (optionally)
      // const mainImg = productSection.querySelector(".preview figure img");
      // if (mainImg) { ... }

      result.product = {
        id: id,
        name: nameEl ? nameEl.textContent.trim() : "",
        isLiked: false,   // There is no active or data-liked class in HTML, so it is always false
        tags: tagsData,
        price: price,
        oldPrice: oldPrice,
        discount: discount,
        discountPercent: discountPercent,
        currency: currency,         // Dynamic, with "RUB" by default
        properties: propertiesObj,
        description: descriptionHtml,
        images: images
      };
    }

    // --- 3. SUGGESTED PRODUCTS ---
    document.querySelectorAll(".suggested .items article").forEach(article => {
      const title = article.querySelector("h3")?.textContent.trim();
      const priceEl = article.querySelector("b");

      const priceTextRaw = priceEl ? priceEl.textContent.trim() : "";
      const suggestedCurrency = getCurrencyCode(priceTextRaw);
      const suggestedPrice = priceTextRaw.replace(/[^0-9]/g, "") || "0";

      result.suggested.push({
        name: title,
        description: article.querySelector("p")?.textContent.trim(),
        image: article.querySelector("img")?.getAttribute("src"),
        price: suggestedPrice,
        currency: suggestedCurrency
      });
    });

    // --- 4. REVIEWS ---
    document.querySelectorAll(".reviews .items article").forEach(article => {
      // Rating calculation: we count the quantity of .filled
      const filledStars = article.querySelectorAll(".rating .filled").length;
      const dateRaw = article.querySelector(".author i")?.textContent?.trim();

      result.reviews.push({
        rating: filledStars,
        author: {
          avatar: article.querySelector(".author img")?.getAttribute("src"),
          name: article.querySelector(".author span")?.textContent.trim()
        },
        title: article.querySelector(".title")?.textContent.trim(),
        description: article.querySelector("p")?.textContent.trim(),
        date: formatDateToDDMMYYYY(dateRaw)
      });
    });

  return result;
}

window.parsePage = parsePage;
