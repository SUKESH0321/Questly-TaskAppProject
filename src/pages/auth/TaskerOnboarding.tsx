import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Upload, Camera, Pencil, Loader2, X, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { readImageAsDataUrl } from "@/lib/imageUtils";
import { withScreen } from "@/stores/screenStore";
import { AadhaarUpload } from "@/components/shared/AadhaarUpload";
import { aadhaarReady, useAadhaarDraft } from "@/stores/aadhaarDraft";
import { LocationField } from "@/components/shared/LocationField";
import api from "@/lib/api";

const steps = [
  "Personal",
  "Skills",
  "Qualifications",
  "Portfolio",
  "Availability",
  "Aadhaar"
];

const skillsList = [
  "Cleaning", "Tutoring", "Repair", "Photography", 
  "Delivery", "Pet Care", "Gardening", "Cooking", "Moving", "Plumbing"
];

interface OnboardingData {
  name: string;
  phone: string;
  location: string;
  skills: string[];
  education: string;
  certificates: string;
  about: string;
  portfolioLink: string;
  workingDays: string[];
  startTime: string;
  endTime: string;
  travelRadius: number;
  avatar: string;
  portfolioImages: string[];
}

export default function TaskerOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Aadhaar card photo + consent: shared with the sign-up page, kept in memory only (demo check).
  const aadhaar = useAadhaarDraft();

  const [data, setData] = useState<OnboardingData>({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    location: user?.location ?? "",
    skills: [],
    education: "",
    certificates: "",
    about: "",
    portfolioLink: "",
    workingDays: [],
    startTime: "09:00",
    endTime: "17:00",
    travelRadius: 10,
    avatar: "",
    portfolioImages: [],
  });

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingPortfolio, setIsUploadingPortfolio] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSkill = (skill: string) => {
    setData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const toggleDay = (day: string) => {
    setData((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day],
    }));
  };

  const handleAvatarFile = async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    setIsUploadingAvatar(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, 512);
      updateField("avatar", dataUrl);
    } catch {
      // Ignore files that can't be read.
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handlePortfolioFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const remaining = Math.max(0, 5 - data.portfolioImages.length);
    const toProcess = fileList.slice(0, remaining);
    if (toProcess.length === 0) return;

    setIsUploadingPortfolio(true);
    try {
      const dataUrls: string[] = [];
      for (const file of toProcess) {
        if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) continue;
        dataUrls.push(await readImageAsDataUrl(file));
      }
      updateField(
        "portfolioImages",
        [...data.portfolioImages, ...dataUrls].slice(0, 5),
      );
    } catch {
      // Ignore files that can't be read.
    } finally {
      setIsUploadingPortfolio(false);
    }
  };

  const handleAvatarSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleAvatarFile(file);
  };

  const handlePortfolioSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (files && files.length > 0) void handlePortfolioFiles(files);
  };

  const handlePortfolioDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) void handlePortfolioFiles(e.dataTransfer.files);
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((curr) => curr + 1);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await withScreen("Creating your tasker profile", async () => {
      await updateUser({
        name: data.name.trim(),
        phone: data.phone,
        location: data.location,
        ...(data.avatar ? { avatar: data.avatar } : {}),
        portfolioImages: data.portfolioImages,
        about: data.about,
        skills: data.skills,
        education: data.education,
        certificates: data.certificates,
        portfolioLink: data.portfolioLink,
        workingDays: data.workingDays,
        startTime: data.startTime,
        endTime: data.endTime,
        travelRadius: data.travelRadius,
      });
      // Start the (demo) Aadhaar check once the card has been added and consent given.
      if (!aadhaar.skip && aadhaar.image && aadhaar.consent && user?.kycMode !== "none") {
        try {
          const res = await api.post("/kyc/start", { consent: true });
          useAuthStore.setState({ user: res.data.user });
        } catch {
          // The profile is saved; verification can be retried from Settings.
        }
      }
      }, 2400);
      navigate("/home", { replace: true });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  // Name is the only required field; everything else can be filled in later in Settings.
  const canContinue =
    currentStep === 0 ? data.name.trim().length >= 2 : currentStep === steps.length - 1 ? aadhaarReady(aadhaar) : true;

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-2">Become a Tasker</h2>
        <p className="text-muted-foreground">Complete your profile to start earning.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between mb-12 relative px-2">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-muted -z-10"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 transition-all duration-300"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        ></div>
        
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors ${
              index <= currentStep 
                ? 'bg-primary text-primary-foreground border-2 border-primary shadow-[0_0_0_4px_hsl(var(--background))]' 
                : 'bg-card text-muted-foreground border-2 border-border shadow-[0_0_0_4px_hsl(var(--background))]'
            }`}>
              {index < currentStep ? <Check size={16} /> : index + 1}
            </div>
            <span className={`text-xs font-medium hidden md:block absolute -bottom-6 ${index <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border p-6 md:p-8 rounded-3xl shadow-sm mt-8">
        {currentStep === 0 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-primary rounded-full"></div>
              <h3 className="text-xl font-bold">Personal Details</h3>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border group hover:border-primary cursor-pointer transition-colors"
                >
                  {data.avatar ? (
                    <img
                      src={data.avatar}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : isUploadingAvatar ? (
                    <Loader2 className="text-primary animate-spin" />
                  ) : (
                    <Camera className="text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground border-2 border-card cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {data.avatar ? <Pencil size={14} /> : <Upload size={14} />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarSelect}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <Input 
                  placeholder="John Doe" 
                  value={data.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Phone Number</label>
                <Input 
                  placeholder="+1 (555) 000-0000"
                  value={data.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Location</label>
                <LocationField
                  value={data.location}
                  onChange={(address) => updateField("location", address)}
                  placeholder="Search or type your address"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-primary rounded-full"></div>
              <h3 className="text-xl font-bold">What are your skills?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Select all that apply.</p>
            
            <div className="flex flex-wrap gap-3">
              {skillsList.map((skill) => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                    data.skills.includes(skill)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent border-border text-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-primary rounded-full"></div>
              <h3 className="text-xl font-bold">Qualifications</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Highest Education</label>
                <Input 
                  placeholder="E.g. Bachelor's in Computer Science"
                  value={data.education}
                  onChange={(e) => updateField("education", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Certificates/Licenses</label>
                <Input 
                  placeholder="E.g. Certified Plumber"
                  value={data.certificates}
                  onChange={(e) => updateField("certificates", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">About Me</label>
                <textarea 
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px]"
                  placeholder="Tell customers why they should hire you..."
                  value={data.about}
                  onChange={(e) => updateField("about", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-primary rounded-full"></div>
              <h3 className="text-xl font-bold">Portfolio</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Showcase your previous work.</p>
            
            <input
              ref={portfolioInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePortfolioSelect}
            />

            <div
              onClick={() => portfolioInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handlePortfolioDrop}
              className="border-2 border-dashed border-primary/30 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-primary/5 transition-colors cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-4">
                {isUploadingPortfolio ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Upload size={24} />
                )}
              </div>
              <h4 className="font-medium">
                {isUploadingPortfolio ? "Processing images..." : "Upload Images"}
              </h4>
              <p className="text-muted-foreground text-xs mt-1">
                Add up to 5 photos of your work ({data.portfolioImages.length}/5)
              </p>
            </div>

            {data.portfolioImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {data.portfolioImages.map((img, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border group"
                  >
                    <img
                      src={img}
                      alt={`Portfolio photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove portfolio photo ${i + 1}`}
                      onClick={() =>
                        updateField(
                          "portfolioImages",
                          data.portfolioImages.filter((_, idx) => idx !== i),
                        )
                      }
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm font-medium mb-1 block">Portfolio Link (Optional)</label>
              <Input 
                placeholder="https://..."
                value={data.portfolioLink}
                onChange={(e) => updateField("portfolioLink", e.target.value)}
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-primary rounded-full"></div>
              <h3 className="text-xl font-bold">Availability</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Working Days</label>
                <div className="flex gap-2 flex-wrap">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <button 
                      key={day} 
                      onClick={() => toggleDay(day)}
                      className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-medium transition-colors ${
                        data.workingDays.includes(day)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-foreground hover:border-primary hover:text-primary"
                      }`}
                    >
                      {day[0]}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Start Time</label>
                  <Input 
                    type="time" 
                    value={data.startTime}
                    onChange={(e) => updateField("startTime", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End Time</label>
                  <Input 
                    type="time" 
                    value={data.endTime}
                    onChange={(e) => updateField("endTime", e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="text-sm font-medium mb-1 block">Travel Radius (miles)</label>
                <input 
                  type="range" 
                  className="w-full primary-primary" 
                  min="1" 
                  max="50" 
                  value={data.travelRadius}
                  onChange={(e) => updateField("travelRadius", parseInt(e.target.value))}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1 mi</span>
                  <span>{data.travelRadius} mi</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-5 animate-in fade-in py-2">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Verify with Aadhaar</h3>
              <p className="text-muted-foreground text-sm">
                Upload a clear photo of your Aadhaar card. Verified taskers get a badge and more trust from customers.
              </p>
            </div>

            <AadhaarUpload />
          </div>
        )}
      </div>

      {saveError && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}

      <div className="flex justify-between mt-8">
        <Button variant="outline" size="lg" onClick={handleBack} disabled={isSaving} className={`${currentStep === 0 ? "invisible" : ""} hover:border-primary hover:text-primary`}>
          Back
        </Button>
        <Button size="lg" onClick={handleNext} disabled={isSaving || !canContinue} className="min-w-[120px] bg-primary hover:bg-primary/90 text-primary-foreground">
          {currentStep === steps.length - 1 ? (isSaving ? "Creating..." : "Create profile") : "Continue"}
        </Button>
      </div>
    </div>
  );
}