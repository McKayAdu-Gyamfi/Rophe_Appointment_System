import Image from "next/image";
import { api } from "@/lib/api";

// Server Component — checks the backend health on load.
export default async function Home() {
  let serverStatus = "not connected";
  try {
    const data = await api<{ status: string }>("/health");
    serverStatus = data.status;
  } catch {
    serverStatus = "not reachable — is the server running?";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "2.5rem 3rem",
          textAlign: "center",
          maxWidth: 480,
        }}
      >
        <Image
          src="/images/rophe-logo.png"
          alt="Rophe Specialist Care Logo"
          width={150}
          height={150}
          style={{ margin: "0 auto 1.25rem", display: "block" }}
        />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
          Rophe Specialist Care
        </h1>
        <p style={{ color: "var(--color-slate)", margin: "0 0 1.5rem" }}>
          Appointment &amp; patient follow-up system
        </p>
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--color-slate)",
            background: "var(--color-canvas)",
            borderRadius: 8,
            padding: "0.75rem 1rem",
          }}
        >
          Backend status: <strong>{serverStatus}</strong>
        </div>
      </div>
    </main>
  );
}
