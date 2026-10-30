import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, LocateFixed, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Bengaluru, where Questly launches first. Only a starting view; nothing is chosen until the user acts.
const DEFAULT_CENTER: L.LatLngTuple = [12.9716, 77.5946];
const NOMINATIM = "https://nominatim.openstreetmap.org";

interface LocationPickerProps {
  /** The address text (also editable by hand). */
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  height?: number;
  className?: string;
}

interface Place {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

/** A short, readable address ("Vittal Mallya Road, Ashokanagar, Bengaluru, 560001") instead of the full OSM name. */
function shortAddress(p: Place, fallback: string): string {
  const a = p.address;
  if (!a) return p.display_name ? p.display_name.split(", ").slice(0, 4).join(", ") : fallback;
  const parts = [
    a.amenity || a.shop || a.building || a.house_number,
    a.road,
    a.neighbourhood || a.suburb,
    a.city || a.town || a.village || a.state_district,
    a.postcode,
  ].filter((x, i, arr): x is string => !!x && arr.indexOf(x) === i);
  return parts.length ? parts.join(", ") : p.display_name?.split(", ").slice(0, 4).join(", ") || fallback;
}

/**
 * A live OpenStreetMap you can pan and tap. Drop the coin pin by tapping the map, dragging the
 * pin, searching for an address, or using your current location; the address field fills in.
 * No account or API key is needed.
 */
export default function LocationPicker({ value, onChange, placeholder = "Search or type your address", height = 220, className }: LocationPickerProps) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reverseSeq = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [busy, setBusy] = useState<"search" | "locate" | "reverse" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /** Looks up the street address for a point (OpenStreetMap Nominatim) and fills the field. */
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    clearTimeout(reverseTimer.current);
    // Nominatim asks for at most one request per second, so wait for the pin to settle.
    reverseTimer.current = setTimeout(async () => {
      const seq = ++reverseSeq.current;
      setBusy("reverse");
      try {
        const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`);
        const json = (await res.json()) as Place;
        const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        if (seq === reverseSeq.current) onChangeRef.current(shortAddress(json, coords));
      } catch {
        if (seq === reverseSeq.current) onChangeRef.current(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } finally {
        if (seq === reverseSeq.current) setBusy(null);
      }
    }, 500);
  }, []);

  const placePin = useCallback(
    (lat: number, lng: number, opts: { zoom?: number; reverse?: boolean } = {}) => {
      const m = map.current;
      if (!m) return;
      marker.current?.setLatLng([lat, lng]);
      if (!marker.current) {
        marker.current = L.marker([lat, lng], { icon: coinIcon(), draggable: true, keyboard: false })
          .addTo(m)
          .on("dragend", () => {
            const p = marker.current!.getLatLng();
            reverseGeocode(p.lat, p.lng);
          });
      }
      if (opts.zoom) m.setView([lat, lng], opts.zoom);
      else m.panTo([lat, lng]);
      if (opts.reverse !== false) reverseGeocode(lat, lng);
    },
    [reverseGeocode],
  );

  // Create the map once.
  useEffect(() => {
    if (!mapEl.current) return;
    const m = L.map(mapEl.current, { center: DEFAULT_CENTER, zoom: 13, zoomControl: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => placePin(e.latlng.lat, e.latlng.lng));
    map.current = m;

    // The map must re-measure itself when its container is first shown or resized.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(mapEl.current);

    return () => {
      clearTimeout(reverseTimer.current);
      ro.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, [placePin]);

  const search = async () => {
    const q = value.trim();
    if (q.length < 3) {
      setMessage("Type at least 3 characters to search.");
      return;
    }
    setBusy("search");
    setMessage(null);
    try {
      const res = await fetch(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&accept-language=en&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`);
      const results = (await res.json()) as Place[];
      if (!results.length) {
        setMessage("We couldn't find that place. Try a nearby landmark, or tap the map.");
        return;
      }
      placePin(Number(results[0].lat), Number(results[0].lon), { zoom: 16, reverse: false });
      onChange(shortAddress(results[0], q));
    } catch {
      setMessage("Search isn't available right now. You can still tap the map.");
    } finally {
      setBusy((b) => (b === "search" ? null : b));
    }
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage("Location isn't available on this device. Search or tap the map instead.");
      return;
    }
    setBusy("locate");
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        placePin(coords.latitude, coords.longitude, { zoom: 17 });
        setBusy(null);
      },
      () => {
        setBusy(null);
        setMessage("We couldn't get your location. Allow location access, or search and tap the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // never submit the surrounding form
      void search();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={200}
          aria-label="Address"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => void search()} disabled={busy === "search"} aria-label="Search this address on the map">
          {busy === "search" ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border">
        <div ref={mapEl} style={{ height }} className="questly-map w-full bg-muted" />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute bottom-6 left-2 z-[500] shadow-soft"
          onClick={locate}
          disabled={busy === "locate"}
        >
          {busy === "locate" ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <LocateFixed size={14} className="mr-1.5" />}
          {busy === "locate" ? "Finding you..." : "Use my location"}
        </Button>
        {busy === "reverse" && (
          <span className="absolute right-2 top-2 z-[500] rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-soft">Finding address...</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Tap the map or drag the coin to set the exact spot. The address fills in for you.</p>
      {message && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

/** The Questly coin as a map pin. */
function coinIcon() {
  return L.divIcon({
    className: "questly-pin",
    html: `<img src="${import.meta.env.BASE_URL}icon-q.png" alt="" draggable="false" />`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}
