import { BUSINESS, PLACEHOLDERS } from '../data/business.js';

// Placeholder page. Family story, owner names, and founding year are
// UNCONFIRMED; placeholders render until the owner confirms them.
export function About() {
  return (
    <section aria-labelledby="about-heading">
      <h1 id="about-heading">About {BUSINESS.name}</h1>
      <p>
        {BUSINESS.name} is a family-owned shop in Oxford, Pennsylvania.
      </p>
      <p>Our story: {PLACEHOLDERS.aboutStory}</p>
      <p>Owners: {PLACEHOLDERS.ownerNames}</p>
      <p>Serving Oxford since: {PLACEHOLDERS.foundingYear}</p>
    </section>
  );
}
