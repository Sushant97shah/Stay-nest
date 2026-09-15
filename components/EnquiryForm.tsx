"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";

export function EnquiryForm({ stayId, stayName, contactNumber }: { stayId: string; stayName: string; contactNumber?: string }) {
  const { configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured) {
      setMessage(`Backend isn't configured yet — please call ${contactNumber || "the property"} directly.`);
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stay_id: stayId,
          stay_name: stayName,
          name: data.get("name"),
          phone: data.get("phone"),
          message: data.get("message"),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.error || "Could not send your enquiry. Please try again.");
        return;
      }
      setMessage("Thanks! The owner/manager will reach out to you soon.");
      form.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="booking-box">
      <h3>Contact this property</h3>
      <p className="location">Prefer a callback? Leave your number and the owner will reach out.</p>
      <form className="booking-grid" onSubmit={handleSubmit}>
        <label>
          Your name
          <input required name="name" maxLength={60} />
        </label>
        <label>
          Your phone
          <input required type="tel" name="phone" maxLength={15} />
        </label>
        <label className="wide-field">
          Message (optional)
          <textarea name="message" maxLength={300} rows={2} />
        </label>
        <button className="btn btn-dark" disabled={busy}>
          Request a callback
        </button>
      </form>
      {message && <p className="otp-copy">{message}</p>}
    </div>
  );
}
