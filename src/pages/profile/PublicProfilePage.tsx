import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Loader2,
  MapPin,
  Phone,
  Star,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TaskCard from "@/components/shared/TaskCard";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { VerifiedBadges } from "@/components/shared/VerifiedBadges";

interface PublicUser {
  id: string;
  name: string;
  role: "customer" | "tasker" | "both" | null;
  phone?: string;
  location?: string;
  avatar?: string;
  portfolioImages?: string[];
  about?: string;
  skills?: string[];
  education?: string;
  certificates?: string;
  portfolioLink?: string;
  workingDays?: string[];
  startTime?: string;
  endTime?: string;
  travelRadius?: number | null;
  phoneVerified?: boolean;
  kycVerified?: boolean;
  kycDemo?: boolean;
  rating: number;
  createdAt?: string;
}

interface ProfileTask {
  id: string;
  title: string;
  category: string;
  budget: number;
  urgencyBonus?: number;
  location: string;
  time: string;
  posterRating: number;
  status: "open" | "in_progress" | "completed" | "expired";
  expiresAt?: string | null;
  imageUrl?: string;
}

export default function PublicProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [tasks, setTasks] = useState<ProfileTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Viewing your own profile opens the editable profile page instead.
    if (id && currentUser && id === currentUser.id) {
      navigate("/profile", { replace: true });
      return;
    }
    if (!id) {
      setError("No profile was specified.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    api
      .get(`/users/${id}`)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data.user);
      })
      .catch(() => {
        if (cancelled) return;
        setError("We couldn't find this user's profile.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // Open tasks this user has posted (best-effort).
    api
      .get(`/tasks/poster/${id}`)
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
        setTasks(
          raw.map((t: any) => ({
            ...t,
            id: t.id ?? t._id?.toString?.(),
          })),
        );
      })
      .catch(() => {
        // Not critical - the profile still renders without the task list.
      });

    return () => {
      cancelled = true;
    };
  }, [id, currentUser, navigate]);

  const roleLabel = (role: PublicUser["role"]) => {
    if (role === "tasker") return "Tasker";
    if (role === "both") return "Customer & Tasker";
    if (role === "customer") return "Customer";
    return "Member";
  };

  const initials =
    profile?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      })
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={20} className="animate-spin text-accent mr-2" />
        <span className="text-muted-foreground">Loading profile…</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center space-y-4">
        <UserIcon size={40} className="mx-auto text-muted-foreground opacity-60" />
        <h2 className="text-xl font-bold">Profile unavailable</h2>
        <p className="text-sm text-muted-foreground">
          {error || "User not found."}
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      {/* Back */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} className="mr-1" /> Back
        </Button>
      </div>

      {/* Profile Header */}
      <div className="bg-card border border-border rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          <Avatar className="w-24 h-24 border-4 border-background shadow-xl">
            <AvatarImage src={profile.avatar} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                {profile.name}
              </h2>
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary hover:bg-primary/20"
              >
                {roleLabel(profile.role)}
              </Badge>
              <VerifiedBadges phone={profile.phoneVerified} id={profile.kycVerified} demo={profile.kycDemo} />
            </div>

            <div className="mt-2 flex items-center justify-center md:justify-start gap-2 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1 text-amber-500">
                <Star size={16} className="fill-current" />
                <span className="font-medium text-foreground">
                  {(profile.rating || 0).toFixed(1)}
                </span>
              </span>
              {profile.location && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {profile.location}
                  </span>
                </>
              )}
              {profile.phone && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone size={14} /> {profile.phone}
                  </span>
                </>
              )}
              {memberSince && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} /> Joined {memberSince}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* About & skills (taskers) */}
      {(profile.about || (profile.skills && profile.skills.length > 0) || profile.education || profile.certificates || profile.portfolioLink) && (
        <section className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4">
          {profile.about && (
            <div>
              <h2 className="text-xl font-bold mb-2">About</h2>
              <p className="text-muted-foreground whitespace-pre-line">{profile.about}</p>
            </div>
          )}
          {profile.skills && profile.skills.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s) => (
                  <Badge key={s} variant="secondary" className="bg-primary/10 text-primary">{s}</Badge>
                ))}
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {profile.education && (<p><span className="font-medium">Education:</span> <span className="text-muted-foreground">{profile.education}</span></p>)}
            {profile.certificates && (<p><span className="font-medium">Certificates:</span> <span className="text-muted-foreground">{profile.certificates}</span></p>)}
            {profile.workingDays && profile.workingDays.length > 0 && (
              <p><span className="font-medium">Available:</span> <span className="text-muted-foreground">{profile.workingDays.join(", ")}{profile.startTime && profile.endTime ? `, ${profile.startTime}-${profile.endTime}` : ""}</span></p>
            )}
            {profile.travelRadius ? (<p><span className="font-medium">Travels up to:</span> <span className="text-muted-foreground">{profile.travelRadius} mi</span></p>) : null}
            {profile.portfolioLink && (
              <p><span className="font-medium">Portfolio:</span>{" "}<a href={profile.portfolioLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{profile.portfolioLink}</a></p>
            )}
          </div>
        </section>
      )}

      {/* Portfolio */}
      {profile.portfolioImages && profile.portfolioImages.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Portfolio</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {profile.portfolioImages.map((img, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl overflow-hidden border border-border bg-muted"
              >
                <img
                  src={img}
                  alt={`${profile.name}'s work ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tasks posted by this user */}
      <section>
        <h2 className="text-xl font-bold mb-4">
          Tasks Posted by {profile.name}
        </h2>
        {tasks.length === 0 ? (
          <div className="bg-muted/50 rounded-2xl p-8 text-center border border-border">
            <Briefcase size={40} className="mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium text-foreground">No open tasks right now</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {profile.name} hasn't posted any open tasks recently.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                title={task.title}
                category={task.category}
                budget={`₹${task.budget}`}
                bonus={task.urgencyBonus}
                location={task.location}
                time={task.time}
                rating={task.posterRating}
                status={task.status}
                expiresAt={task.expiresAt}
                imageUrl={task.imageUrl}
                posterName={profile.name}
                posterId={profile.id}
                poster={profile.avatar}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}