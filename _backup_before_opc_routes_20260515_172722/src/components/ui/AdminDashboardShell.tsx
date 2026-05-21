import React from "react";

export default function AdminDashboardShell() {
  console.log("✔ AdminDashboardShell mounted");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F7F7F9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif"
    }}>
      <h1 style={{
        color:"#111",
        fontSize:"32px",
        fontWeight:600
      }}>
        Miraka Admin Dashboard Shell
      </h1>
    </div>
  );
}
