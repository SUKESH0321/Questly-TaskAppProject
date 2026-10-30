import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Check,
  Upload,
  Loader2,
  X,
  Calendar,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTaskStore } from "@/stores/taskStore";
import { withScreen } from "@/stores/screenStore";
import { LocationField } from "@/components/shared/LocationField";
import { readImageAsDataUrl } from "@/lib/imageUtils";
import { CATEGORIES } from "@/lib/categories";
import { DEFAULT_SEARCH_MINUTES, SEARCH_WINDOWS, URGENCY_BONUSES, isUrgentWindow, searchWindowLabel } from "@/lib/searchWindow";
import { getApiError } from "@/lib/errors";

const steps = ["Details", "Photos", "Location", "Budget", "Time", "Preview"];

interface TaskFormData {
  title: string;
  description: string;
  category: string;
  location: string;
  budget: number;
  time: string;
  date: string;
  imageUrl: string;
  scheduleDate: string;
  scheduleTime: string;
}

export default function CreateTask() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { addTask } = useTaskStore();

  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    category: "Cleaning",
    location: "",
    budget: 85,
    time: "ASAP",
    date: "Today",
    imageUrl: "",
    scheduleDate: "",
    scheduleTime: "",
  });
  const [customBudget, setCustomBudget] = useState("");
  const [searchMinutes, setSearchMinutes] = useState<number>(DEFAULT_SEARCH_MINUTES);
  // Optional urgency tip, only valid with the 15 and 30 minute windows.
  const [urgencyBonus, setUrgencyBonus] = useState(0);
  const urgentEnabled = isUrgentWindow(searchMinutes);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof TaskFormData>(
    key: K,
    value: TaskFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setSubmitError("Please choose an image file (PNG, JPG, GIF or SVG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError("Image must be smaller than 5MB.");
      return;
    }
    setIsProcessingImage(true);
    setSubmitError(null);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      updateField("imageUrl", dataUrl);
    } catch {
      setSubmitError("We couldn't read that image. Please try another one.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleImageFile(file);
  };

  const handleImageDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleImageFile(file);
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((curr) => curr + 1);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const scheduled = formData.time === "Scheduled";
      const newTask = {
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim(),
        budget: formData.budget,
        ...(formData.location.trim() ? { location: formData.location.trim() } : {}),
        time: scheduled ? formData.scheduleTime || "Scheduled" : formData.time,
        date: scheduled ? formData.scheduleDate : new Date().toISOString().split("T")[0],
        searchMinutes,
        ...(urgentEnabled && urgencyBonus > 0 ? { urgencyBonus } : {}),
        ...(formData.imageUrl ? { imageUrl: formData.imageUrl } : {}),
      };
      const createdTask = await withScreen("Creating your task", () => addTask(newTask), 1800);
      navigate(`/tasks/success?id=${createdTask.id}`);
    } catch (err) {
      setSubmitError(getApiError(err, "We couldn't create this task right now."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((curr) => curr - 1);
    } else {
      navigate(-1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.title.trim().length >= 3 && formData.description.trim().length >= 10;
      case 3:
        return formData.budget > 0;
      case 4:
        return formData.time !== "Scheduled" || !!formData.scheduleDate;
      default:
        return true;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 pt-8">
      <div className="flex items-center mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="mr-4"
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Post a new task</h1>
          <p className="text-muted-foreground text-sm">
            Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-10 relative">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-border -z-10"></div>
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 transition-all duration-300"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition-colors ${
                index <= currentStep
                  ? "bg-primary text-primary-foreground border-2 border-primary shadow-[0_0_0_4px_hsl(var(--background))]"
                  : "bg-card text-muted-foreground border-2 border-border shadow-[0_0_0_4px_hsl(var(--background))]"
              }`}
            >
              {index < currentStep ? <Check size={16} /> : index + 1}
            </div>
            <span
              className={`text-xs font-medium hidden md:block ${index <= currentStep ? "text-foreground" : "text-muted-foreground"}`}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border p-6 md:p-8 rounded-2xl shadow-sm">
        {submitError && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {currentStep === 0 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
            <h2 className="text-xl font-bold">What do you need help with?</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Task Title
                </label>
                <Input
                  placeholder="E.g. Clean my 2BHK apartment"
                  className="text-lg py-6"
                  value={formData.title}
                  onChange={(e) => updateField("title", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Description
                </label>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[120px]"
                  placeholder="Provide details about what needs to be done..."
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Category
                </label>
                <select
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.category}
                  onChange={(e) => updateField("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
            <h2 className="text-xl font-bold">Add a photo</h2>
            <p className="text-muted-foreground">
              A photo helps taskers understand what needs to be done. (Optional)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />

            {formData.imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img
                  src={formData.imageUrl}
                  alt="Task photo preview"
                  className="w-full h-64 md:h-80 object-cover"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingImage}
                  >
                    <Upload size={14} className="mr-1" />
                    Change
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => updateField("imageUrl", "")}
                  >
                    <X size={14} className="mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageDrop}
                disabled={isProcessingImage}
                className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer group disabled:opacity-60"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-4">
                  {isProcessingImage ? (
                    <Loader2 size={28} className="animate-spin" />
                  ) : (
                    <Upload size={28} />
                  )}
                </div>
                <h3 className="font-medium text-lg">
                  {isProcessingImage
                    ? "Processing image..."
                    : "Click to upload or drag and drop"}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">
                  SVG, PNG, JPG or GIF (max. 5MB)
                </p>
              </button>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
            <h2 className="text-xl font-bold">Where should this be done?</h2>

            <p className="text-sm text-muted-foreground">Search for the address, use your current location, or tap the map to drop the pin.</p>
            <LocationField
              value={formData.location}
              onChange={(address) => updateField("location", address)}
              placeholder="Search or type the task address"
              height={260}
            />
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
            <h2 className="text-xl font-bold">Set your budget</h2>

            <div className="grid grid-cols-2 gap-4">
              <div
                className={`border rounded-xl p-6 cursor-pointer transition-colors text-center relative overflow-hidden ${
                  formData.budget === 85
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary"
                }`}
                onClick={() => {
                  updateField("budget", 85);
                  setCustomBudget("");
                }}
              >
                <Badge className="absolute top-2 right-2 bg-accent/20 text-accent hover:bg-accent/20">
                  Suggested
                </Badge>
                <div className="text-3xl font-bold text-primary mb-2">₹85</div>
                <div className="text-sm font-medium text-foreground">
                  Estimated Fair Price
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Based on similar tasks
                </div>
              </div>

              <div className="border border-border rounded-xl p-6 text-center flex flex-col justify-center items-center">
                <span className="text-3xl font-bold text-muted-foreground mb-2 leading-none">₹</span>
                <div className="font-medium text-foreground mb-2">
                  Set custom budget
                </div>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  className="text-center"
                  inputMode="numeric"
                  min={1}
                  value={customBudget}
                  onChange={(e) => {
                    setCustomBudget(e.target.value);
                    updateField("budget", parseInt(e.target.value) || 0);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
            <h2 className="text-xl font-bold">When do you need it done?</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Asap / Now", icon: Clock, value: "ASAP" },
                { label: "Today", icon: Calendar, value: "Today" },
                { label: "Schedule Later", icon: Calendar, value: "Scheduled" },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  className={`py-8 flex-col gap-2 ${
                    formData.time === option.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => updateField("time", option.value)}
                >
                  <option.icon />
                  <span>{option.label}</span>
                </Button>
              ))}
            </div>

            {formData.time === "Scheduled" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.scheduleDate}
                    onChange={(e) => updateField("scheduleDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Time</label>
                  <Input
                    type="time"
                    value={formData.scheduleTime}
                    onChange={(e) => updateField("scheduleTime", e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-3 border-t border-border pt-6">
              <div>
                <h3 className="font-display text-lg font-bold">How long should we look for a tasker?</h3>
                <p className="text-sm text-muted-foreground">
                  A live countdown starts when you post. If nobody picks it up in time, we'll notify you so you can repost.
                </p>
              </div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Search window">
                {SEARCH_WINDOWS.map((w) => (
                  <button
                    key={w.minutes}
                    type="button"
                    role="radio"
                    aria-checked={searchMinutes === w.minutes}
                    onClick={() => {
                      setSearchMinutes(w.minutes);
                      if (!isUrgentWindow(w.minutes)) setUrgencyBonus(0);
                    }}
                    className={`rounded-2xl border px-4 py-2.5 text-left transition-colors ${
                      searchMinutes === w.minutes
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-foreground/30"
                    }`}
                  >
                    <span className="block text-sm font-bold">{w.label}</span>
                    {w.hint && <span className="block text-[11px] text-muted-foreground">{w.hint}</span>}
                  </button>
                ))}
              </div>

              <div className={`rounded-2xl border border-dashed p-4 transition-opacity ${urgentEnabled ? "border-primary/40 bg-primary/5" : "border-border opacity-50"}`}>
                <p className="text-sm font-bold">Add a tip for a faster pickup <span className="font-normal text-muted-foreground">(optional)</span></p>
                <p className="mb-3 text-xs text-muted-foreground">
                  {urgentEnabled
                    ? "Paid to the tasker on top of your budget. Tap again to remove."
                    : "Available when you choose a 15 or 30 minute search."}
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Urgency tip">
                  {URGENCY_BONUSES.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      role="radio"
                      aria-checked={urgencyBonus === amount}
                      disabled={!urgentEnabled}
                      onClick={() => setUrgencyBonus((cur) => (cur === amount ? 0 : amount))}
                      className={`min-w-[4.5rem] rounded-xl border px-4 py-2 text-sm font-bold tabular-nums transition-colors disabled:cursor-not-allowed ${
                        urgencyBonus === amount
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card enabled:hover:border-primary enabled:hover:text-primary"
                      }`}
                    >
                      +₹{amount}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
            <h2 className="text-xl font-bold">Review your task</h2>

            <div className="bg-muted p-6 rounded-xl space-y-4">
              <div>
                <h3 className="font-bold text-lg">
                  {formData.title || "Untitled Task"}
                </h3>
                <p className="text-muted-foreground">
                  {formData.description || "No description provided."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Category
                  </div>
                  <div className="font-medium">{formData.category}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Budget
                  </div>
                  <div className="font-medium text-primary">
                    ₹{formData.budget}
                    {urgentEnabled && urgencyBonus > 0 && (
                      <span className="ml-1.5 text-xs font-bold text-accent">+ ₹{urgencyBonus} urgent tip</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Location
                  </div>
                  <div className="font-medium">
                    {formData.location || "Uses your profile location"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Search window</div>
                  <div className="font-medium">{searchWindowLabel(searchMinutes)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Time</div>
                  <div className="font-medium">
                    {formData.time === "Scheduled"
                      ? `${formData.scheduleDate} ${formData.scheduleTime}`.trim()
                      : formData.time}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          size="lg"
          onClick={handleBack}
          className={currentStep === 0 ? "invisible" : ""}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button
          size="lg"
          onClick={handleNext}
          className="min-w-[120px]"
          disabled={!canProceed() || isSubmitting}
        >
          {isSubmitting
            ? "Posting..."
            : currentStep === steps.length - 1
              ? "Post Task"
              : "Continue"}
        </Button>
      </div>
    </div>
  );
}
