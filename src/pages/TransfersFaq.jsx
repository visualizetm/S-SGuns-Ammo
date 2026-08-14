import { BUSINESS } from '../data/business.js';
import { TRANSFERS_INTRO, FAQ_ITEMS } from '../data/transfersFaq.js';
import { TransferInquiryForm } from '../components/forms/TransferInquiryForm.jsx';

// Placeholder page. All transfer and FAQ copy renders from
// src/data/transfersFaq.js, which is flagged LEGAL REVIEW REQUIRED.
export function TransfersFaq() {
  return (
    <>
      <section aria-labelledby="transfers-heading">
        <h1 id="transfers-heading">{TRANSFERS_INTRO.heading}</h1>
        <p>{TRANSFERS_INTRO.body}</p>
        <p>
          Call <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a> for
          current transfer details.
        </p>
      </section>

      <section aria-labelledby="faq-heading">
        <h2 id="faq-heading">Frequently asked questions</h2>
        <dl>
          {FAQ_ITEMS.map((item) => (
            <div key={item.id}>
              <dt>{item.question}</dt>
              <dd>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="transfer-form-heading">
        <h2 id="transfer-form-heading">Ask about a transfer</h2>
        <p>
          Send the details and we will follow up. This is an inquiry only, not
          an order.
        </p>
        <TransferInquiryForm />
      </section>
    </>
  );
}
