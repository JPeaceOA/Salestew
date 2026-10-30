# SaleStew

**SaleStew** is a Nigerian Product Sales & Inventory Tracker SPA built with **React**, **Vite**, **Tailwind CSS**, and **Zustand**. It features OWASP-hardened client storage, real-time analytics, automated forecasting, vendor management, currency conversion (NGN / USD), and an organic botanical design system with both Light and Dark themes.

---

## ✨ Features

- **📊 Sales Performance Dashboard**: Interactive charts (revenue by period, category distributions, product leaderboards, monthly trends) powered by Chart.js.
- **📦 Inventory Management**: Real-time stock tracking, low-stock threshold alerts, category filters, and CSV export.
- **🔮 Demand Forecasting**: Ordinary least-squares (OLS) linear regression projections with momentum signals and confidence indicators.
- **📋 Transaction History & Ledger**: Comprehensive filterable historical ledger with inline cell editing and transaction detail inspector.
- **🏭 Supplier / Vendor Management**: Track supplier contacts, physical addresses, lead times, and linked catalog items.
- **📄 Report Generator**: Daily, monthly, quarterly, and custom range reports with instant print/PDF export and CSV download.
- **📝 Audit & Activity Stream**: Full chronological logging of mutations, administrative changes, and authentication events.
- **🛡️ Enterprise-Grade Authentication**:
  - WebCrypto PBKDF2-SHA256 password hashing with salt and iteration hardening.
  - Role-Based Access Control (Admin & Staff roles).
  - Brute-force lockout and session duration tracking.
- **🎨 Organic Design System**:
  - Unified **Dark Theme** (deep forest slate with warm cedar accents).
  - Editorial **Light Theme** (clean linen & sage, zero yellow glare, soothing on the eyes).
  - Bahnschrift typography across all tables, forms, and headers.
  - Lucide React icon integration.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/JPeaceOA/Salestew.git
   cd Salestew
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

---

## 🔑 Default Credentials

- **Admin Account**: `admin` / `admin123`
- Additional accounts can be created via the registration screen or through the Admin Console.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS + Custom CSS Design Tokens
- **State Management**: Zustand (with localStorage persistence)
- **Visualizations**: Chart.js + react-chartjs-2
- **Icons**: Lucide React
- **Security**: WebCrypto API (PBKDF2, SHA-256)
