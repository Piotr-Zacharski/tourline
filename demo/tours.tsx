import { createTourline, defineTour } from "../src";
import type { ContentOverrides } from "../src";

export const welcomeTour = defineTour({
  id: "welcome",
  steps: [
    {
      id: "hello",
      title: "Welcome to Harbor",
      content: "Harbor sends your invoices and chases late payments for you. Ten quick stops, about a minute.",
    },
    {
      id: "nav",
      target: "sidebar",
      placement: "right",
      title: "Everything lives here",
      content: "Invoices, clients and reports. Your workspace switches from the top of this bar.",
    },
    {
      id: "clients",
      target: "nav-clients",
      placement: "right",
      padding: 2,
      title: "Your clients",
      content: "Contact details, payment terms and every invoice you have sent them, in one place.",
    },
    {
      id: "settings",
      target: "nav-settings",
      placement: "right",
      padding: 2,
      title: "Make it yours",
      content: "Add your logo, tax numbers and teammates. Invoices pick it all up automatically.",
    },
    {
      id: "outstanding",
      target: "outstanding",
      placement: "bottom",
      title: "What clients owe you",
      content: "Everything sent and not yet paid. Harbor sends a reminder 3 days after the due date.",
    },
    {
      id: "overdue",
      target: "overdue",
      placement: "bottom",
      padding: 3,
      title: "Overdue turns red",
      content: "This part is already late. A tight spotlight keeps the eye on just this number.",
    },
    {
      id: "paid",
      target: "paid",
      placement: "left",
      title: "Money in",
      content: "Payments land here the moment a client pays, compared with last month.",
    },
    {
      id: "table",
      target: "invoice-table",
      placement: "top",
      title: "Every invoice",
      content: "Number, client, due date and status. Click a row to open it.",
    },
    {
      id: "search",
      target: "search",
      placement: "bottom",
      title: "Find anything",
      content: "Search by client, number or amount. Press / to jump here from anywhere.",
    },
    {
      id: "new",
      target: "new-invoice",
      placement: "bottom",
      advanceOn: "click",
      title: "Create your first invoice",
      content: "Pick a client, add line items, send. Click New invoice to finish the tour.",
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
      content: "The newest first. Status updates the moment a client pays.",
    },
    {
      id: "late",
      target: "overdue-row",
      placement: "bottom",
      padding: 2,
      interactive: true,
      title: "This one is late",
      content: "Kowalski & Syn is past the due date. The row stays clickable while this step is open.",
    },
    {
      id: "paid",
      target: "paid",
      placement: "left",
      title: "Paid this month",
      content: "Paid invoices drop out of Outstanding and add up here.",
    },
    {
      id: "search",
      target: "search",
      placement: "bottom",
      advanceOn: "input",
      title: "Find anything",
      content: "Search by client, number or amount. Type something to finish.",
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
      advanceOn: "click",
      title: "Reports",
      content: "Click Reports (or Next) and the panel loads. The tour waits for it to appear.",
    },
    {
      id: "chart",
      target: "revenue-chart",
      placement: "top",
      padding: 12,
      allowBack: false,
      title: "Revenue by month",
      content: "This chart rendered 1 second late. Tourline found it with no extra code.",
    },
    {
      id: "best",
      target: "best-month",
      placement: "top",
      padding: 4,
      title: "Your best month",
      content: "September: €9.1k. Hover any bar in the full app to see which invoices made it up.",
    },
    {
      id: "export",
      target: "nav-settings",
      placement: "right",
      padding: 2,
      title: "Send it to your accountant",
      content: "In Settings you can email this report as a PDF on the first of every month.",
    },
    {
      id: "done",
      allowSkip: false,
      title: "You are all set",
      content: "No Skip or × on this step: it is set with allowSkip: false. Click Done to finish.",
    },
  ],
});

/** Lets a step switch the mock app's view; main.tsx listens for it. */
export const VIEW_EVENT = "harbor:view";
const showView = (view: "invoices" | "reports") => () => window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: view }));

export const optionsTour = defineTour({
  id: "options",
  steps: [
    {
      id: "center",
      title: "Every option, one per step",
      content: "Each step shows one setting and names it. No target here, so the step sits in the center.",
    },
    {
      id: "top",
      target: "outstanding",
      placement: "top",
      title: "placement: \"top\"",
      content: "Above the target. When there is no room, the popover flips to the opposite side.",
    },
    {
      id: "right",
      target: "outstanding",
      placement: "right",
      title: "placement: \"right\"",
      content: "Same target, now on the right. The spotlight stays put, only the popover moves.",
    },
    {
      id: "bottom",
      target: "outstanding",
      placement: "bottom",
      title: "placement: \"bottom\"",
      content: "The default, unless you change ui.placement on the provider.",
    },
    {
      id: "left",
      target: "paid",
      placement: "left",
      title: "placement: \"left\"",
      content: "To the left of Paid this month. On a narrow screen it flips or clamps to the viewport.",
    },
    {
      id: "tight",
      target: "overdue",
      padding: 0,
      title: "padding: 0",
      content: "The spotlight hugs the element exactly.",
    },
    {
      id: "loose",
      target: "overdue",
      padding: 18,
      title: "padding: 18",
      content: "Same element with room to breathe. The default comes from ui.padding.",
    },
    {
      id: "interactive",
      target: "search",
      interactive: true,
      title: "interactive: true",
      content: "Click into search and type. The tour stays open and ← → move the caret, not the tour.",
    },
    {
      id: "advance",
      target: "nav-clients",
      placement: "right",
      advanceOn: "click",
      title: "advanceOn: \"click\"",
      content: "Click Clients to continue. Next still works too.",
    },
    {
      id: "enter",
      target: "revenue-chart",
      placement: "top",
      onEnter: showView("reports"),
      onLeave: showView("invoices"),
      title: "onEnter and onLeave",
      content: "onEnter opened Reports, and the step waited for the chart to load. onLeave switches back.",
    },
    {
      id: "no-back",
      target: "new-invoice",
      allowBack: false,
      title: "allowBack: false",
      content: "No Back button here, and ← does nothing.",
    },
    {
      id: "no-skip",
      allowSkip: false,
      title: "allowSkip: false",
      content: "No Skip, no ×, and Esc or a backdrop click will not close it. Only Done finishes the tour.",
    },
  ],
});

export const onboarding = createTourline([welcomeTour, invoiceTour, reportsTour, optionsTour] as const);

/** What the dashboard would serve: copy edited without a deploy. */
export const polishCopy: ContentOverrides = {
  welcome: {
    hello: { title: "Witaj w Harbor", content: "Harbor wysyła faktury i przypomina o spóźnionych płatnościach. Dziesięć krótkich przystanków, około minuty." },
    nav: { title: "Wszystko jest tutaj", content: "Faktury, klienci i raporty. Przestrzeń roboczą zmienisz na górze paska." },
    clients: { title: "Twoi klienci", content: "Dane kontaktowe, terminy płatności i wszystkie wysłane im faktury w jednym miejscu." },
    settings: { title: "Dopasuj do siebie", content: "Dodaj logo, NIP i współpracowników. Faktury pobiorą to automatycznie." },
    outstanding: { title: "Ile winni ci klienci", content: "Wszystko wysłane i jeszcze nieopłacone. Przypomnienie idzie 3 dni po terminie." },
    overdue: { title: "Zaległe są czerwone", content: "Ta część jest już po terminie. Ciasne podświetlenie skupia uwagę tylko na tej kwocie." },
    paid: { title: "Wpływy", content: "Płatności pojawiają się tu, gdy tylko klient zapłaci, w porównaniu z zeszłym miesiącem." },
    table: { title: "Wszystkie faktury", content: "Numer, klient, termin i status. Kliknij wiersz, aby go otworzyć." },
    search: { title: "Znajdź wszystko", content: "Szukaj po kliencie, numerze lub kwocie. Naciśnij /, aby przejść tu z dowolnego miejsca." },
    new: { title: "Wystaw pierwszą fakturę", content: "Wybierz klienta, dodaj pozycje, wyślij. Kliknij New invoice, aby zakończyć." },
  },
};
