import { useEffect, useState } from "react";
import { onboarding } from "./tours";

const INVOICES = [
  { number: "INV-1042", client: "Northwind Studio", amount: "€2,400.00", due: "12 Nov", status: "Sent" },
  { number: "INV-1041", client: "Kowalski & Syn", amount: "€860.00", due: "28 Oct", status: "Overdue" },
  { number: "INV-1040", client: "Lumen Labs", amount: "€5,120.00", due: "20 Oct", status: "Paid" },
  { number: "INV-1039", client: "Atlas Coffee", amount: "€310.50", due: "15 Oct", status: "Paid" },
] as const;

const MONTHS = [
  { label: "Jun", value: 6.2 },
  { label: "Jul", value: 7.8 },
  { label: "Aug", value: 5.4 },
  { label: "Sep", value: 9.1 },
  { label: "Oct", value: 8.7 },
] as const;

type View = "invoices" | "reports";

const RevenueChart = () => {
  const max = 10;
  return (
    <div className="chart" {...onboarding.anchor("revenue-chart")}>
      <p className="chart__title">Revenue, € thousands</p>
      <div className="chart__bars">
        {MONTHS.map((month) => (
          <div key={month.label} className="chart__col">
            <span className="chart__value">{month.value.toFixed(1)}</span>
            <span className="chart__bar" style={{ height: `${(month.value / max) * 100}%` }} />
            <span className="chart__label">{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReportsView = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(timer);
  }, []);
  return ready ? <RevenueChart /> : <div className="chart chart--loading">Loading report…</div>;
};

const InvoiceTable = () => (
  <div className="table-wrap" {...onboarding.anchor("invoice-table")}>
    <table className="table">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Client</th>
          <th>Due</th>
          <th className="num">Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {INVOICES.map((invoice) => (
          <tr key={invoice.number}>
            <td className="mono">{invoice.number}</td>
            <td>{invoice.client}</td>
            <td>{invoice.due}</td>
            <td className="num">{invoice.amount}</td>
            <td>
              <span className="pill" data-status={invoice.status.toLowerCase()}>
                {invoice.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const MockApp = ({ view, onViewChange }: { view: View; onViewChange: (view: View) => void }) => (
  <div className="mock" aria-label="Example app: Harbor invoicing">
    <aside className="mock__side" {...onboarding.anchor("sidebar")}>
      <p className="mock__brand">Harbor</p>
      <nav className="mock__nav">
        <button type="button" data-active={view === "invoices"} onClick={() => onViewChange("invoices")}>
          Invoices
        </button>
        <button type="button">Clients</button>
        <button
          type="button"
          data-active={view === "reports"}
          onClick={() => onViewChange("reports")}
          {...onboarding.anchor("nav-reports")}
        >
          Reports
        </button>
        <button type="button">Settings</button>
      </nav>
    </aside>
    <div className="mock__main">
      <div className="mock__bar">
        <input
          id="mock-search"
          className="mock__search"
          type="search"
          placeholder="Search invoices"
          aria-label="Search invoices"
          {...onboarding.anchor("search")}
        />
        <button type="button" className="mock__cta" {...onboarding.anchor("new-invoice")}>
          New invoice
        </button>
      </div>
      {view === "invoices" ? (
        <>
          <div className="stats">
            <div className="stat" {...onboarding.anchor("outstanding")}>
              <span className="stat__label">Outstanding</span>
              <span className="stat__value">€3,260</span>
              <span className="stat__note stat__note--bad">€860 overdue</span>
            </div>
            <div className="stat">
              <span className="stat__label">Paid this month</span>
              <span className="stat__value">€5,430</span>
              <span className="stat__note">+12% vs Sep</span>
            </div>
          </div>
          <InvoiceTable />
        </>
      ) : (
        <ReportsView />
      )}
    </div>
  </div>
);
