/**
 * React-PDF Styles for Invoice
 * Layout: A4 page with Swiss invoice formatting
 * Typography: Termina Extra Bold (header) + Helvetica Neue (body)
 * Measurements: Precise padding and spacing matching HTML layout
 */

import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  /* ==========================================
     PAGE LAYOUT
  ========================================== */
  page: {
    fontFamily: "HelveticaNeue",
    fontSize: 11,
    lineHeight: 1.35,
    color: "#000",
    // A4 padding (matching HTML: 95pt top, 55pt right, 60pt bottom, 70pt left)
    paddingTop: 95,
    paddingRight: 55,
    paddingBottom: 60,
    paddingLeft: 70,
  },

  /* ==========================================
     HEADER - Logo (Text-based, Centered, 4cm width)
  ========================================== */
  header: {
    alignItems: "center",
    marginBottom: 22,
  },

  logo: {
    fontFamily: "Termina",
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: 0.5,
    width: 113, // 4cm ≈ 113pt
    textAlign: "center",
  },

  /* ==========================================
     ADDRESS SECTION - Two columns (Client | Miraka)
  ========================================== */
  addressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 18,
  },

  addressBlock: {
    width: "45%",
  },

  addressName: {
    fontWeight: 700,
    marginBottom: 2,
    lineHeight: 1.2,
  },

  addressLine: {
    lineHeight: 1.2,
    marginBottom: 1,
  },

  /* ==========================================
     META - Date and Invoice Number
  ========================================== */
  metaSection: {
    marginTop: 10,
    marginBottom: 26,
  },

  metaText: {
    fontSize: 11,
    lineHeight: 1.4,
  },

  /* ==========================================
     TITLE - Project Name
  ========================================== */
  title: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 10,
    lineHeight: 1.3,
  },

  /* ==========================================
     GREETING
  ========================================== */
  greeting: {
    marginBottom: 10,
    lineHeight: 1.35,
  },

  /* ==========================================
     INTRO TEXT
  ========================================== */
  intro: {
    marginBottom: 22,
    lineHeight: 1.35,
  },

  /* ==========================================
     TABLE - Invoice Items
  ========================================== */
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 4,
    marginBottom: 6,
    fontWeight: 700,
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    paddingVertical: 6,
  },

  colPos: {
    width: "6%",
  },

  colDesc: {
    width: "54%",
  },

  colQty: {
    width: "20%",
  },

  colPrice: {
    width: "20%",
    textAlign: "right",
  },

  /* ==========================================
     TOTALS SECTION
  ========================================== */
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 12,
    paddingRight: 0,
  },

  subtotalLabel: {
    fontSize: 11,
    fontWeight: 500,
    marginRight: 20,
  },

  subtotalAmount: {
    fontSize: 11,
    fontWeight: 700,
    width: 100,
    textAlign: "right",
  },

  vatRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
    paddingRight: 0,
  },

  vatLabel: {
    fontSize: 11,
    fontWeight: 500,
    marginRight: 20,
  },

  vatAmount: {
    fontSize: 11,
    fontWeight: 700,
    width: 100,
    textAlign: "right",
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#000",
    paddingRight: 0,
  },

  totalLabel: {
    fontSize: 12,
    fontWeight: 700,
    marginRight: 20,
  },

  totalAmount: {
    fontSize: 13,
    fontWeight: 700,
    width: 100,
    textAlign: "right",
  },

  /* ==========================================
     FOOTER - Fixed position, 4-column grid
  ========================================== */
  footer: {
    position: "absolute",
    bottom: 60, // Same as page paddingBottom
    left: 70,   // Same as page paddingLeft
    right: 55,  // Same as page paddingRight
    fontSize: 7.5,
    lineHeight: 1.45,
  },

  footerRow: {
    flexDirection: "row",
    width: "100%",
  },

  // Column widths: 1fr / 0.75fr / 1.25fr / 1fr (relative)
  footerCol1: {
    width: "24%",
    paddingRight: 8,
  },

  footerCol2: {
    width: "18%",
    paddingRight: 8,
  },

  footerCol3: {
    width: "32%",
    paddingRight: 8,
  },

  footerCol4: {
    width: "18%",
  },

  footerText: {
    fontSize: 7.5,
    lineHeight: 1.45,
    marginBottom: 1,
  },

  footerBold: {
    fontWeight: 700,
  },
});
