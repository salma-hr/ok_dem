import React from "react";

export function CriterionImage({ criterion, size = 64 }) {
  return (
    <div style={{
      width: size,
      height: size,
      background: "#f8fafc",
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#bbb",
      fontSize: 12,
      border: "1px solid #eee",
    }}>
      <span style={{ fontSize: size * 0.4 }}>🔧</span>
    </div>
  );
}