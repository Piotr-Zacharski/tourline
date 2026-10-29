import { createTourline, defineTour } from "../src";
import type { ContentOverrides } from "../src";

export const welcomeTour = defineTour({
  id: "welcome",
  steps: [
    {
      id: "hello",
      title: "Welcome to Harbor",
      content: "Harbor sends your invoices and chases late payments for you. This takes 30 seconds.",
    },
    {
      id: "nav",
      target: "sidebar",
      placement: "right",
      title: "Everything lives here",
      content: "Invoices, clients and reports. Your workspace switches from the top of this bar.",
    },
    {
      id: "outstanding",
      target: "outstanding",
      title: "What clients owe you",
      content: "Overdue amounts turn red. Harbor sends a reminder 3 days after the due date.",
    },
    {
      id: "new",
      target: "new-invoice",
      placement: "bottom",
      title: "Create your first invoice",
      content: "Pick a client, add line items, send. Most people finish in under two minutes.",
    },
  ],
});

export const invoiceTour = defineTour({
  id: "invoices",
  steps: [
    {
      id: "table",
      target: "invoice-table",
      placement: "top",
      title: "Your invoices",
      content: "Click a row to open it. Status updates the moment a client pays.",
    },
    {
      id: "search",
      target: "search",
      placement: "bottom",
      title: "Find anything",
      content: "Search by client, number or amount. Press / to jump here from anywhere.",
    },
  ],
});

export const reportsTour = defineTour({
  id: "reports",
  steps: [
    {
      id: "open",
      target: "nav-reports",
      placement: "right",
      title: "Reports",
      content: "Click Next and the reports panel loads. The tour waits for it to appear.",
    },
    {
      id: "chart",
      target: "revenue-chart",
      placement: "top",
      title: "Revenue by month",
      content: "This chart rendered 1 second late. Tourline found it with no extra code.",
    },
  ],
});

export const onboarding = createTourline([welcomeTour, invoiceTour, reportsTour] as const);

/** What the dashboard would serve: copy edited without a deploy. */
export const polishCopy: ContentOverrides = {
  welcome: {
    hello: { title: "Witaj w Harbor", content: "Harbor wysyła faktury i przypomina o spóźnionych płatnościach. To zajmie 30 sekund." },
    nav: { title: "Wszystko jest tutaj", content: "Faktury, klienci i raporty. Przestrzeń roboczą zmienisz na górze paska." },
    outstanding: { title: "Ile winni ci klienci", content: "Zaległe kwoty robią się czerwone. Przypomnienie idzie 3 dni po terminie." },
    new: { title: "Wystaw pierwszą fakturę", content: "Wybierz klienta, dodaj pozycje, wyślij. Zwykle trwa to mniej niż dwie minuty." },
  },
};
