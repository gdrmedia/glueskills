"use client";

import { useEffect } from "react";
import type React from "react";
import type { Partner } from "@/lib/spec-sheets/enrich";
import type { HydratedPlacement } from "./spec-viewer";
import { DetailView } from "./detail-view";
import { partnerById } from "./helpers";

export function DetailModal({
  placement,
  partners,
  onClose,
}: {
  placement: HydratedPlacement;
  partners: Partner[];
  onClose: () => void;
}): React.ReactElement | null {
  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const p = partnerById(placement.partner, partners);
  if (!p) return null;

  return (
    <div className="bsd-modal-bd" onClick={onClose}>
      <div className="bsd-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="bsd-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <DetailView
          placement={placement}
          partners={partners}
          partnerColor={p.color}
          modal
        />
      </div>
    </div>
  );
}
