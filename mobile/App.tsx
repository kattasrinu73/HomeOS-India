import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  canTransitionJob,
  formatIndianRupees,
  warrantyEndsOn,
  type JobStatus,
} from "./src/workflow";
import { homeosApi, homeosApiConfigured } from "./src/homeosApi";

const C = {
  ink: "#14251F",
  forest: "#173D34",
  moss: "#2C6A57",
  sage: "#D9E4D7",
  cream: "#F7F4EE",
  paper: "#FFFDF9",
  sand: "#E9E2D6",
  coral: "#E76B4D",
  gold: "#C89538",
  success: "#1D7A58",
  muted: "#6E786F",
  line: "#E4DED4",
  white: "#FFFFFF",
};

type CustomerTab = "home" | "jobs" | "passport" | "account";
type CustomerScreen =
  | "home"
  | "fix"
  | "analysis"
  | "matches"
  | "tracking"
  | "quote"
  | "otp"
  | "payment"
  | "invoice"
  | "passport"
  | "jobs"
  | "account";

type SyncedHome = {
  id: number;
  label: string;
  locality: string;
  city: string;
  healthScore: number;
};

type SyncedServiceRequest = {
  id: number;
  publicId: string;
  category: string;
  status: JobStatus;
  urgency: string;
  description: string;
};

type SyncedPassportDocument = {
  id: number;
  documentType: string;
  label: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
};

type NativeRequestDetail = {
  request: SyncedServiceRequest;
  technician: { displayName: string } | null;
  quote: { id: number; reason: string; total: number; status: string } | null;
  quoteItems: Array<{ id: number; label: string; amount: number; itemType: string }>;
  payment: { method: string; status: string; visitFee: number; labour: number; parts: number; taxes: number; platformFee: number; credits: number; total: number } | null;
  invoice: { invoiceNumber: string; technicianIdentity: string; warrantyDays: number; warrantyEndsAt: Date | string } | null;
  warranty: { endsAt: Date | string; status: string } | null;
};

type NativeAssessment = {
  category: "electrical" | "plumbing" | "ac_appliances" | "carpentry" | "cleaning" | "ro" | "painting" | "other";
  urgency: "low" | "medium" | "high" | "emergency";
  possibleDiagnosis: string;
  safetyNote: string;
  followUpQuestions: string[];
  estimateMin: number;
  estimateMax: number;
};

const statusCopy: Record<JobStatus, string> = {
  submitted: "Request received",
  matched: "Specialists found",
  assigned: "Technician selected",
  en_route: "Technician is on the way",
  arrived: "Technician has arrived",
  diagnosing: "Diagnosis in progress",
  quote_pending: "Quote needs approval",
  quote_approved: "Quote approved",
  in_progress: "Work in progress",
  completion_pending: "Enter completion OTP",
  completed: "Service completed",
  paid: "Payment confirmed",
};

function tapFeedback() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function AppIcon({ name, size = 20, color = C.forest }: { name: string; size?: number; color?: string }) {
  return <Ionicons name={name as never} size={size} color={color} />;
}

function Press({ children, onPress, style, disabled }: { children: ReactNode; onPress: () => void; style?: object; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [style, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}

function PrimaryButton({ label, icon, onPress, disabled = false }: { label: string; icon?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press disabled={disabled} onPress={onPress} style={styles.primaryButton}>
      <LinearGradient colors={[C.coral, "#D8573D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
        <Text style={styles.primaryButtonText}>{label}</Text>
        {icon ? <AppIcon name={icon} size={18} color={C.white} /> : null}
      </LinearGradient>
    </Press>
  );
}

function ScreenHeader({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  return (
    <View style={styles.screenHeader}>
      {onBack ? (
        <Press onPress={onBack} style={styles.headerIcon}>
          <AppIcon name="chevron-back" size={22} />
        </Press>
      ) : (
        <View style={styles.headerIconPlaceholder} />
      )}
      <Text style={styles.screenTitle}>{title}</Text>
      <View style={styles.headerAction}>{action}</View>
    </View>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warm" | "dark" }) {
  const pillStyle = tone === "success" ? styles.pillSuccess : tone === "warm" ? styles.pillWarm : tone === "dark" ? styles.pillDark : styles.pillNeutral;
  const textStyle = tone === "dark" ? styles.pillTextDark : styles.pillText;
  return (
    <View style={[styles.pill, pillStyle]}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

function Row({ icon, title, detail, action, onPress }: { icon: string; title: string; detail?: string; action?: ReactNode; onPress?: () => void }) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowIcon}><AppIcon name={icon} size={19} /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {action ?? (onPress ? <AppIcon name="chevron-forward" size={18} color={C.muted} /> : null)}
    </View>
  );
  return onPress ? <Press onPress={onPress} style={styles.rowPress}>{content}</Press> : content;
}

function BottomNav({ active, onChange }: { active: CustomerTab; onChange: (tab: CustomerTab) => void }) {
  const tabs: Array<{ key: CustomerTab; label: string; icon: string }> = [
    { key: "home", label: "Home", icon: "home-outline" },
    { key: "jobs", label: "Jobs", icon: "calendar-outline" },
    { key: "passport", label: "Passport", icon: "shield-checkmark-outline" },
    { key: "account", label: "Account", icon: "person-outline" },
  ];
  return (
    <BlurView intensity={92} tint="light" style={styles.bottomNav}>
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <Press key={tab.key} onPress={() => onChange(tab.key)} style={styles.tabPress}>
            <AppIcon name={tab.icon} size={22} color={selected ? C.coral : C.muted} />
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
          </Press>
        );
      })}
    </BlurView>
  );
}

export default function App() {
  const [role, setRole] = useState<"customer" | "technician">("customer");
  const [tab, setTab] = useState<CustomerTab>("home");
  const [screen, setScreen] = useState<CustomerScreen>("home");
  const [issue, setIssue] = useState("My AC is not cooling well.");
  const [selectedCategory, setSelectedCategory] = useState("AC & appliances");
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState("Kondapur, Hyderabad");
  const [jobStatus, setJobStatus] = useState<JobStatus>("submitted");
  const [quoteApproved, setQuoteApproved] = useState(false);
  const [otp, setOtp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [homeStep, setHomeStep] = useState(0);
  const [syncedHome, setSyncedHome] = useState<SyncedHome | null>(null);
  const [syncedRequests, setSyncedRequests] = useState<SyncedServiceRequest[]>([]);
  const [syncedDocuments, setSyncedDocuments] = useState<SyncedPassportDocument[]>([]);
  const [syncedRequestDetail, setSyncedRequestDetail] = useState<NativeRequestDetail | null>(null);
  const [nativeAssessment, setNativeAssessment] = useState<NativeAssessment | null>(null);
  const [nativeSubmittingIssue, setNativeSubmittingIssue] = useState(false);
  const [nativeCreatingRequest, setNativeCreatingRequest] = useState(false);
  const [nativeDocumentUploading, setNativeDocumentUploading] = useState(false);
  const [nativeHomeSaving, setNativeHomeSaving] = useState(false);
  const [nativeHomeAddress, setNativeHomeAddress] = useState("");
  const [nativeHomeType, setNativeHomeType] = useState<"apartment" | "independent_house" | "villa" | "other">("apartment");
  const [nativeSyncStatus, setNativeSyncStatus] = useState<"loading" | "ready" | "signin_required" | "unavailable">("loading");

  const warrantyEnd = useMemo(() => warrantyEndsOn(new Date()), []);
  const invoiceLines = [
    ["Visit fee", 199],
    ["Labour", 300],
    ["Parts", 450],
    ["Taxes", 0],
  ] as const;
  const invoiceTotal = invoiceLines.reduce((total, [, amount]) => total + amount, 0);

  const refreshNativeHome = async () => {
    if (!homeosApiConfigured()) {
      setNativeSyncStatus("unavailable");
      return;
    }
    setNativeSyncStatus("loading");
    try {
      const [homes, requests] = await Promise.all([
        (homeosApi as any).homeos.homes.list.query() as Promise<SyncedHome[]>,
        (homeosApi as any).homeos.requests.list.query() as Promise<SyncedServiceRequest[]>,
      ]);
      setSyncedHome(homes[0] ?? null);
      setSyncedRequests(requests);
      const documents = homes[0]
        ? await (homeosApi as any).homeos.passport.listDocuments.query({ homeId: homes[0].id }) as SyncedPassportDocument[]
        : [];
      setSyncedDocuments(documents);
      const detail = requests[0]
        ? await (homeosApi as any).homeos.requests.detail.query({ publicId: requests[0].publicId }) as NativeRequestDetail
        : null;
      setSyncedRequestDetail(detail);
      setNativeSyncStatus("ready");
    } catch {
      setSyncedHome(null);
      setSyncedRequests([]);
      setSyncedDocuments([]);
      setSyncedRequestDetail(null);
      setNativeSyncStatus("signin_required");
    }
  };

  useEffect(() => {
    void refreshNativeHome();
  }, []);

  const changeTab = (nextTab: CustomerTab) => {
    setTab(nextTab);
    setScreen(nextTab);
  };

  const goHome = () => {
    setTab("home");
    setScreen("home");
  };

  const startFix = (category?: string) => {
    if (category) {
      setSelectedCategory(category);
      setIssue("");
    }
    setScreen("fix");
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo permission needed", "Allow photo-library access to add a photo of the problem.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setAttachmentUri(result.assets[0]?.uri ?? null);
  };

  const choosePassportDocument = async () => {
    if (!syncedHome || nativeSyncStatus !== "ready") {
      Alert.alert("Sign in required", "Sign in and save a HomeOS home before adding protected Passport documents.");
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset?.mimeType;
    const fileSize = asset?.size;
    if (!asset || !mimeType || !fileSize) {
      Alert.alert("Document unavailable", "Choose a PDF, JPG, PNG, or WEBP file with a readable file size.");
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      Alert.alert("Unsupported file", "Use a PDF, JPG, PNG, or WEBP document.");
      return;
    }
    if (fileSize > 10 * 1024 * 1024) {
      Alert.alert("Document too large", "Choose a Passport document smaller than 10 MB.");
      return;
    }
    setNativeDocumentUploading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const stored = await (homeosApi as any).homeos.uploads.storeDocument.mutate({ base64: `data:${mimeType};base64,${base64}`, mimeType });
      await (homeosApi as any).homeos.passport.addDocument.mutate({
        homeId: syncedHome.id,
        documentType: "service_document",
        label: asset.name || "Passport document",
        fileKey: stored.key,
        fileUrl: stored.url,
        mimeType,
        fileSize,
      });
      await refreshNativeHome();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Upload unavailable", "HomeOS could not secure this Passport document right now. Please try again.");
    } finally {
      setNativeDocumentUploading(false);
    }
  };

  const useLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Location permission needed", "Allow location to use your current service address.");
      return;
    }
    try {
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationLabel("Current location, Hyderabad");
    } catch {
      Alert.alert("Location unavailable", "You can still set your home address manually.");
    }
  };

  const saveNativeHomeSetup = async () => {
    const address = nativeHomeAddress.trim() || locationLabel.trim();
    if (!address || address === "Set service location") {
      Alert.alert("Add your address", "Enter the address for the home you want HomeOS to protect.");
      return;
    }
    if (nativeSyncStatus !== "ready") {
      Alert.alert("Sign in required", "Sign in with your HomeOS account before saving a protected home record.");
      return;
    }
    setNativeHomeSaving(true);
    try {
      await (homeosApi as any).homeos.homes.create.mutate({
        label: "My home",
        addressLine1: address,
        locality: address.split(",")[0]?.trim() || address,
        city: "Hyderabad",
        homeType: nativeHomeType,
      });
      await refreshNativeHome();
      setOnboardingVisible(false);
      setHomeStep(0);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Home setup unavailable", "HomeOS could not save this protected home record right now. Please try again.");
    } finally {
      setNativeHomeSaving(false);
    }
  };

  const submitIssue = async () => {
    if (!issue.trim()) {
      Alert.alert("Describe the issue", "Tell us what is happening at home so we can guide you.");
      return;
    }
    if (nativeSyncStatus !== "ready" || !syncedHome) {
      Alert.alert("Sign in required", "Sign in with your HomeOS account and save a home before requesting a protected AI assessment.");
      return;
    }
    setNativeSubmittingIssue(true);
    try {
      const assessment = await (homeosApi as any).homeos.diagnosis.assess.mutate({ description: issue }) as NativeAssessment;
      setNativeAssessment(assessment);
      setSelectedCategory(assessment.category.replaceAll("_", " "));
      setJobStatus("submitted");
      setScreen("analysis");
    } catch {
      Alert.alert("Assessment unavailable", "HomeOS could not complete the protected assessment right now. Please try again.");
    } finally {
      setNativeSubmittingIssue(false);
    }
  };

  const showMatches = async () => {
    if (!nativeAssessment || !syncedHome) {
      Alert.alert("Assessment required", "Complete the protected issue assessment before requesting a technician match.");
      return;
    }
    setNativeCreatingRequest(true);
    try {
      const request = await (homeosApi as any).homeos.requests.create.mutate({
        homeId: syncedHome.id,
        category: nativeAssessment.category,
        description: issue,
        possibleDiagnosis: nativeAssessment.possibleDiagnosis,
        urgency: nativeAssessment.urgency,
        estimateMin: nativeAssessment.estimateMin,
        estimateMax: nativeAssessment.estimateMax,
      }) as SyncedServiceRequest;
      setSyncedRequests((requests) => [request, ...requests.filter((existing) => existing.id !== request.id)]);
      setJobStatus("submitted");
      setScreen("matches");
    } catch {
      Alert.alert("Request unavailable", "HomeOS could not create your secure service request right now. Please try again.");
    } finally {
      setNativeCreatingRequest(false);
    }
  };

  const selectTechnician = () => {
    setJobStatus("en_route");
    setScreen("tracking");
  };

  const showQuote = () => {
    setJobStatus("quote_pending");
    setScreen("quote");
  };

  const approveQuote = async () => {
    if (!syncedRequestDetail?.quote) {
      Alert.alert("Quote unavailable", "A protected technician quote must be available before approval.");
      return;
    }
    try {
      await (homeosApi as any).homeos.requests.approveQuote.mutate({ quoteId: syncedRequestDetail.quote.id });
      await refreshNativeHome();
      setQuoteApproved(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Approval unavailable", "HomeOS could not approve this quote right now. Please try again.");
    }
  };

  const verifyOtp = () => {
    if (!canTransitionJob("completion_pending", "completed", { quoteApproved, completionOtp: otp })) {
      Alert.alert("Enter the completion OTP", "Use the numeric one-time code sent for this service before marking it complete.");
      return;
    }
    setJobStatus("completed");
    setScreen("payment");
  };

  const pay = () => {
    setJobStatus("paid");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScreen("invoice");
  };

  const renderCustomerScreen = () => {
    if (screen === "home") {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.homeTopBar}>
            <View>
              <Text style={styles.eyebrow}>HOMEOS INDIA</Text>
              <Text style={styles.greeting}>Good morning</Text>
            </View>
            <Press onPress={() => setOnboardingVisible(true)} style={styles.avatar}>
              <Text style={styles.avatarText}>S</Text>
            </Press>
          </View>
          <Press onPress={useLocation} style={styles.locationLine}>
            <AppIcon name="location-sharp" size={16} color={C.coral} />
            <Text style={styles.locationText}>{syncedHome ? `${syncedHome.locality}, ${syncedHome.city}` : nativeSyncStatus === "loading" ? "Loading saved home…" : locationLabel}</Text>
            <AppIcon name="chevron-down" size={15} color={C.muted} />
          </Press>

          <LinearGradient colors={[C.forest, "#255846"]} style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <Pill label="HOME CARE, SIMPLIFIED" tone="dark" />
            <Text style={styles.heroTitle}>Something wrong{`\n`}at home?</Text>
            <Text style={styles.heroBody}>Describe the problem. We’ll guide the next right step.</Text>
            <Press onPress={() => startFix()} style={styles.heroCta}>
              <Text style={styles.heroCtaText}>Tell us what's wrong</Text>
              <View style={styles.heroCtaIcon}><AppIcon name="arrow-forward" size={18} color={C.forest} /></View>
            </Press>
          </LinearGradient>

          <View style={styles.homeHealth}>
            <View style={styles.healthOrb}><Text style={styles.healthNumber}>{syncedHome?.healthScore ?? "—"}</Text><Text style={styles.healthSuffix}>/100</Text></View>
            <View style={styles.healthCopy}><Text style={styles.healthLabel}>Home Health</Text><Text style={styles.healthDetail}>{syncedHome ? `Saved for ${syncedHome.label}` : nativeSyncStatus === "signin_required" ? "Sign in to synchronise your home health." : "A saved HomeOS home will show its score here."}</Text></View>
            <Press onPress={() => setScreen("passport")} style={styles.roundLink}><AppIcon name="arrow-forward" size={18} /></Press>
          </View>

          {syncedRequests[0] ? <Press onPress={() => setScreen("tracking")} style={styles.homeActiveJob}>
            <View style={styles.homeActiveJobTop}><Pill label={syncedRequests[0].status.replaceAll("_", " ").toUpperCase()} tone="success" /><Text style={styles.homeActiveJobEta}>{syncedRequests[0].urgency} priority</Text></View>
            <View style={styles.homeActiveJobBody}><View style={styles.homeActiveJobIcon}><AppIcon name="construct-outline" size={21} color={C.white} /></View><View style={styles.rowCopy}><Text style={styles.homeActiveJobTitle}>{syncedRequests[0].category.replaceAll("_", " ")}</Text><Text style={styles.homeActiveJobDetail}>{syncedRequests[0].publicId} · Tap to view service status</Text></View><AppIcon name="chevron-forward" size={19} color={C.white} /></View>
          </Press> : <Press onPress={() => startFix()} style={styles.homeActiveJob}><View style={styles.homeActiveJobTop}><Pill label="NO ACTIVE REQUEST" tone="success" /><Text style={styles.homeActiveJobEta}>Start when ready</Text></View><View style={styles.homeActiveJobBody}><View style={styles.homeActiveJobIcon}><AppIcon name="add" size={21} color={C.white} /></View><View style={styles.rowCopy}><Text style={styles.homeActiveJobTitle}>Tell us what’s wrong</Text><Text style={styles.homeActiveJobDetail}>A saved service request will appear here after it is synchronised.</Text></View><AppIcon name="chevron-forward" size={19} color={C.white} /></View></Press>}

          <SectionTitle title="Quick services" action="View all" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceRail}>
            {[
              ["flash-outline", "Electrical", "Electrical"],
              ["water-outline", "Plumbing", "Plumbing"],
              ["snow-outline", "AC care", "AC & appliances"],
              ["construct-outline", "Appliances", "AC & appliances"],
              ["hammer-outline", "Carpentry", "Carpentry"],
            ].map(([icon, label, category]) => (
              <Press key={label} onPress={() => startFix(category)} style={styles.serviceCard}>
                <View style={styles.serviceIcon}><AppIcon name={icon} size={22} /></View>
                <Text style={styles.serviceLabel}>{label}</Text>
              </Press>
            ))}
          </ScrollView>

          <SectionTitle title="Your home" />
          <View style={styles.panel}>
            <Row icon="calendar-outline" title="Maintenance reminders" detail="No synchronised reminders yet. Saved appliance maintenance will appear after account sync." onPress={() => startFix("AC & appliances")} />
            <View style={styles.panelLine} />
            <Row icon="shield-checkmark-outline" title="Active warranties" detail="No synchronised warranty record yet." onPress={() => setScreen("passport")} />
          </View>
          <View style={styles.safetyNote}><AppIcon name="information-circle-outline" size={18} color={C.moss} /><Text style={styles.safetyText}>For sparks, gas smells, or a major leak, use Emergency help and follow the safety guidance first.</Text></View>
        </ScrollView>
      );
    }

    if (screen === "fix") {
      return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScreenHeader title="Fix anything" onBack={goHome} />
          <ScrollView contentContainerStyle={styles.flowContent} keyboardShouldPersistTaps="handled">
            <Pill label="STEP 1 OF 3" tone="warm" />
            <Text style={styles.flowTitle}>Tell us what you’re noticing.</Text>
            <Text style={styles.flowSubtitle}>You don’t need to know the service category. A qualified professional will confirm the diagnosis.</Text>
            <View style={styles.inputPanel}>
              <Text style={styles.inputLabel}>What’s happening?</Text>
              <TextInput value={issue} onChangeText={setIssue} multiline placeholder="Example: The bedroom AC runs, but the room is not cooling." placeholderTextColor="#98958D" style={styles.textArea} />
              <View style={styles.inputBottom}><Text style={styles.inputHint}>{selectedCategory}</Text><AppIcon name="sparkles-outline" size={18} color={C.coral} /></View>
            </View>
            <Press onPress={choosePhoto} style={styles.attachmentCard}>
              {attachmentUri ? <Image source={{ uri: attachmentUri }} style={styles.attachmentImage} /> : <View style={styles.attachmentIcon}><AppIcon name="camera-outline" size={23} color={C.coral} /></View>}
              <View style={styles.attachmentCopy}><Text style={styles.attachmentTitle}>{attachmentUri ? "Issue photo added" : "Add a photo"}</Text><Text style={styles.attachmentText}>{attachmentUri ? "This will help the technician prepare." : "A clear photo can help us ask better questions."}</Text></View>
              <AppIcon name="add-circle-outline" size={22} color={C.forest} />
            </Press>
            <View style={styles.guidanceBox}><AppIcon name="shield-checkmark-outline" size={19} color={C.success} /><Text style={styles.guidanceText}>We use this information to recommend a service—not to replace an on-site professional diagnosis.</Text></View>
          </ScrollView>
          <View style={styles.stickyAction}><PrimaryButton disabled={nativeSubmittingIssue} label={nativeSubmittingIssue ? "Assessing securely…" : "Continue to guidance"} icon="arrow-forward" onPress={submitIssue} /></View>
        </KeyboardAvoidingView>
      );
    }

    if (screen === "analysis") {
      return (
        <ScrollView contentContainerStyle={styles.flowContent} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Guided assessment" onBack={() => setScreen("fix")} />
          <Pill label="ESTIMATE, NOT A DIAGNOSIS" tone="warm" />
          <Text style={styles.flowTitle}>Pre-visit guidance.</Text>
          <Text style={styles.flowSubtitle}>This protected assessment is preliminary. A qualified professional confirms the cause on site.</Text>
          <View style={styles.analysisCard}>
            <View style={styles.analysisTitleRow}><View style={styles.sparkBadge}><AppIcon name="sparkles" size={17} color={C.white} /></View><Text style={styles.analysisHeading}>Pre-visit guidance</Text></View>
            <Text style={styles.analysisDiagnosis}>{nativeAssessment?.possibleDiagnosis ?? "Secure assessment unavailable."}</Text>
            <Text style={styles.analysisBody}>{nativeAssessment?.safetyNote ?? "Return to the issue screen and complete the protected assessment before requesting a technician."}</Text>
            <View style={styles.analysisMeta}><View><Text style={styles.metaLabel}>RECOMMENDED SERVICE</Text><Text style={styles.metaValue}>{nativeAssessment?.category.replaceAll("_", " ") ?? "Not available"}</Text></View><View style={styles.metaDivider} /><View><Text style={styles.metaLabel}>URGENCY</Text><Text style={styles.metaValue}>{nativeAssessment?.urgency ?? "Not available"}</Text></View></View>
          </View>
          <View style={styles.estimateCard}><Text style={styles.estimateTitle}>Indicative visit estimate</Text><Text style={styles.estimatePrice}>{nativeAssessment ? `${formatIndianRupees(nativeAssessment.estimateMin)}–${formatIndianRupees(nativeAssessment.estimateMax)}` : "Not available"}</Text><Text style={styles.estimateNote}>The final amount depends on the on-site diagnosis, parts, and your approval of an itemised quote.</Text></View>
          <PrimaryButton disabled={nativeCreatingRequest || !nativeAssessment} label={nativeCreatingRequest ? "Creating secure request…" : "Request qualified matching"} icon="arrow-forward" onPress={showMatches} />
        </ScrollView>
      );
    }

    if (screen === "matches") {
      return (
        <ScrollView contentContainerStyle={styles.flowContent} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Find a qualified professional" onBack={() => setScreen("analysis")} />
          <Text style={styles.flowTitle}>Controlled verified matching.</Text>
          <Text style={styles.flowSubtitle}>The signed-in HomeOS service creates a request, then dispatches real eligible professionals by verified skill, availability, distance, and reliability.</Text>
          <View style={[styles.matchCard, styles.matchCardSelected]}><View style={styles.matchTop}><View style={styles.techAvatar}><AppIcon name="shield-checkmark-outline" size={24} color={C.white} /></View><View style={styles.matchName}><Text style={styles.matchPerson}>{syncedRequests[0] ? syncedRequests[0].publicId : "Awaiting secure dispatch"}</Text><Text style={styles.matchSpecialty}>{syncedRequests[0] ? `${syncedRequests[0].category.replaceAll("_", " ")} request is ${syncedRequests[0].status.replaceAll("_", " ")}.` : "No technician, rating, availability, or ETA is shown until it is returned by the protected matching service."}</Text></View></View><Text style={styles.matchFoot}>HomeOS will show the real accepted technician after a verified offer is accepted. No fabricated professional details are displayed.</Text></View>
          <View style={styles.guidanceBox}><AppIcon name="information-circle-outline" size={19} color={C.moss} /><Text style={styles.guidanceText}>Open Jobs to refresh the protected request status. Dispatch rounds are controlled by verified operations rules.</Text></View>
          <PrimaryButton label="View synchronised jobs" icon="arrow-forward" onPress={() => { setTab("jobs"); setScreen("jobs"); }} />
        </ScrollView>
      );
    }

    if (screen === "tracking") {
      return (
        <ScrollView contentContainerStyle={styles.flowContent} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Active job" onBack={goHome} />
          <View style={styles.trackingHeader}><Pill label={(syncedRequests[0]?.status ?? "AWAITING DISPATCH").replaceAll("_", " ").toUpperCase()} tone="success" /><Text style={styles.trackingTime}>{syncedRequests[0] ? syncedRequests[0].publicId : "No synchronised request"}</Text><Text style={styles.trackingAddress}>{syncedHome ? `${syncedHome.locality}, ${syncedHome.city}` : locationLabel}</Text></View>
          <View style={styles.mapFrame}><View style={styles.mapGrid} /><View style={[styles.mapRoad, styles.roadOne]} /><View style={[styles.mapRoad, styles.roadTwo]} /><View style={styles.homePin}><AppIcon name="home" size={18} color={C.white} /></View><View style={styles.mapLegend}><View style={styles.legendDot} /><Text style={styles.legendText}>A live route and ETA appear only after a real technician is assigned and shares location securely.</Text></View></View>
          <View style={styles.techSummary}><View style={styles.techAvatar}><AppIcon name="shield-checkmark-outline" size={21} color={C.white} /></View><View style={styles.techSummaryCopy}><Text style={styles.matchPerson}>Technician pending</Text><Text style={styles.matchSpecialty}>HomeOS will show the verified accepted professional here.</Text></View></View>
          <View style={styles.timeline}><Timeline active={Boolean(syncedRequests[0])} label="Request created" detail="Your protected request has been saved." /><Timeline label="Technician assignment" detail="Verified dispatch will update this screen after an offer is accepted." /><Timeline label="Diagnosis & quote" detail="No work begins before you approve the quote." /><Timeline label="Completion" detail="A one-time OTP is required to close the job." /></View>
        </ScrollView>
      );
    }

    if (screen === "quote") {
      return (
        <ScrollView contentContainerStyle={styles.flowContent} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Review quote" onBack={() => setScreen("tracking")} />
          <Pill label="ACTION REQUIRED" tone="warm" />
          <Text style={styles.flowTitle}>{syncedRequestDetail?.quote ? "Review protected quote." : "No quote available yet."}</Text>
          <Text style={styles.flowSubtitle}>{syncedRequestDetail?.quote ? "Review every item sent by the assigned technician. Work cannot begin until you explicitly approve." : "The technician’s itemised diagnosis and quote will appear here after it is securely sent."}</Text>
          {syncedRequestDetail?.quote ? <View style={styles.quotePanel}><Text style={styles.quoteReason}>Reason: {syncedRequestDetail.quote.reason}</Text>{syncedRequestDetail.quoteItems.map((item) => <View key={item.id} style={styles.billLine}><Text style={styles.billLabel}>{item.label}</Text><Text style={styles.billAmount}>{formatIndianRupees(item.amount)}</Text></View>)}<View style={styles.panelLine} /><View style={styles.billLine}><Text style={styles.billTotal}>Total</Text><Text style={styles.billTotal}>{formatIndianRupees(syncedRequestDetail.quote.total)}</Text></View></View> : <View style={styles.panel}><Row icon="receipt-outline" title="Awaiting itemised quote" detail="The verified assigned technician must send a diagnosis and itemised quote before you can approve work." /></View>}
          <View style={styles.hardGate}><AppIcon name="lock-closed-outline" size={20} color={C.coral} /><View style={styles.hardGateCopy}><Text style={styles.hardGateTitle}>Approval is required</Text><Text style={styles.hardGateText}>The technician cannot start this work unless you explicitly approve this quote.</Text></View></View>
          {syncedRequestDetail?.request.status === "quote_approved" || syncedRequestDetail?.request.status === "in_progress" ? <View style={styles.approvedState}><AppIcon name="checkmark-circle" size={24} color={C.success} /><View><Text style={styles.approvedTitle}>Quote approved</Text><Text style={styles.approvedText}>Work can now proceed. You will be asked for a completion OTP when the technician marks it ready.</Text></View></View> : <PrimaryButton disabled={!syncedRequestDetail?.quote} label="Approve quote & start" icon="checkmark" onPress={approveQuote} />}
          {syncedRequestDetail?.request.status === "completion_pending" ? <PrimaryButton label="Work complete — enter OTP" icon="key-outline" onPress={() => setScreen("otp")} /> : null}
          <Press onPress={() => Alert.alert("Quote declined", "Your request will stay open so you can ask for another qualified technician.")} style={styles.textOnlyButton}><Text style={styles.textOnlyButtonText}>Reject and request another technician</Text></Press>
        </ScrollView>
      );
    }

    if (screen === "otp") {
      return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScreenHeader title="Complete service" onBack={() => setScreen("quote")} />
          <View style={styles.otpContent}><View style={styles.otpIcon}><AppIcon name="key-outline" size={28} color={C.coral} /></View><Text style={styles.flowTitle}>Enter your completion OTP.</Text><Text style={styles.flowSubtitle}>Check the one-time code sent for this service. It protects your home from an unauthorised completion.</Text><TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={8} placeholder="Enter numeric OTP" placeholderTextColor="#9B978F" style={styles.otpInput} /><View style={styles.hardGate}><AppIcon name="shield-checkmark-outline" size={20} color={C.success} /><View style={styles.hardGateCopy}><Text style={styles.hardGateTitle}>Completion safeguard</Text><Text style={styles.hardGateText}>A completed service will create an invoice, activate a 30-day warranty, and update your Home Service Passport.</Text></View></View></View>
          <View style={styles.stickyAction}><PrimaryButton label="Verify OTP & continue" icon="arrow-forward" onPress={verifyOtp} /></View>
        </KeyboardAvoidingView>
      );
    }

    if (screen === "payment") {
      return (
        <ScrollView contentContainerStyle={styles.flowContent} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Payment" onBack={() => setScreen("otp")} />
          <Text style={styles.flowTitle}>Review your bill.</Text>
          <Text style={styles.flowSubtitle}>Every charge is itemised before payment.</Text>
          <View style={styles.quotePanel}>{invoiceLines.map(([label, amount]) => <View key={label} style={styles.billLine}><Text style={styles.billLabel}>{label}</Text><Text style={styles.billAmount}>{formatIndianRupees(amount)}</Text></View>)}<View style={styles.panelLine} /><View style={styles.billLine}><Text style={styles.billTotal}>Amount due</Text><Text style={styles.billTotal}>{formatIndianRupees(invoiceTotal)}</Text></View></View>
          <SectionTitle title="Pay with" />
          {["UPI", "Card", "Wallet credits"].map((method) => <Press key={method} onPress={() => setPaymentMethod(method)} style={[styles.payMethod, paymentMethod === method && styles.payMethodSelected]}><View style={styles.payMethodIcon}><AppIcon name={method === "UPI" ? "qr-code-outline" : method === "Card" ? "card-outline" : "wallet-outline"} size={20} /></View><Text style={styles.payMethodText}>{method}</Text>{paymentMethod === method ? <AppIcon name="checkmark-circle" size={21} color={C.coral} /> : <View style={styles.radioEmpty} />}</Press>)}
          <View style={styles.guidanceBox}><AppIcon name="lock-closed-outline" size={19} color={C.success} /><Text style={styles.guidanceText}>Live payment collection is enabled after your UPI and card payment provider has been securely connected.</Text></View>
          <PrimaryButton label={`Pay ${formatIndianRupees(invoiceTotal)}`} icon="lock-closed-outline" onPress={pay} />
        </ScrollView>
      );
    }

    if (screen === "invoice") {
      return (
        <ScrollView contentContainerStyle={styles.flowContent} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Service complete" onBack={goHome} />
          <View style={styles.completeBadge}><AppIcon name={syncedRequestDetail?.invoice ? "checkmark" : "time-outline"} size={30} color={C.white} /></View><Text style={[styles.flowTitle, styles.centered]}>{syncedRequestDetail?.invoice ? "Your home is protected." : "Invoice pending confirmation."}</Text><Text style={[styles.flowSubtitle, styles.centered]}>{syncedRequestDetail?.invoice ? "Payment is confirmed and your service record is ready." : "An invoice and 30-day warranty appear after the payment provider confirms the protected payment."}</Text>
          {syncedRequestDetail?.invoice && syncedRequestDetail.payment ? <View style={styles.invoiceCard}><View style={styles.invoiceTop}><View><Text style={styles.invoiceBrand}>HOMEOS</Text><Text style={styles.invoiceTitle}>Digital invoice</Text></View><Pill label={syncedRequestDetail.payment.status.toUpperCase()} tone="success" /></View><View style={styles.invoiceMeta}><Text style={styles.metaLabel}>JOB ID</Text><Text style={styles.invoiceMetaValue}>{syncedRequestDetail.request.publicId}</Text><Text style={styles.metaLabel}>TECHNICIAN</Text><Text style={styles.invoiceMetaValue}>{syncedRequestDetail.invoice.technicianIdentity}</Text></View>{([['Visit fee', syncedRequestDetail.payment.visitFee], ['Labour', syncedRequestDetail.payment.labour], ['Parts', syncedRequestDetail.payment.parts], ['Taxes', syncedRequestDetail.payment.taxes], ['Platform fee', syncedRequestDetail.payment.platformFee], ['Wallet credits', -syncedRequestDetail.payment.credits]] as const).map(([label, amount]) => <View key={label} style={styles.billLine}><Text style={styles.billLabel}>{label}</Text><Text style={styles.billAmount}>{formatIndianRupees(amount)}</Text></View>)}<View style={styles.panelLine} /><View style={styles.billLine}><Text style={styles.billTotal}>Total paid · {syncedRequestDetail.payment.method.toUpperCase()}</Text><Text style={styles.billTotal}>{formatIndianRupees(syncedRequestDetail.payment.total)}</Text></View><View style={styles.warrantyInvoice}><AppIcon name="shield-checkmark" size={24} color={C.success} /><View><Text style={styles.warrantyInvoiceTitle}>{syncedRequestDetail.invoice.warrantyDays}-day service warranty</Text><Text style={styles.warrantyInvoiceText}>Active through {new Date(syncedRequestDetail.warranty?.endsAt ?? syncedRequestDetail.invoice.warrantyEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text></View></View></View> : <View style={styles.panel}><Row icon="receipt-outline" title="No confirmed invoice yet" detail="Payment method, technician identity, itemised charges, invoice number, and warranty dates appear here only after protected provider confirmation." /></View>}
          <PrimaryButton label="View Home Service Passport" icon="arrow-forward" onPress={() => { setTab("passport"); setScreen("passport"); }} />
        </ScrollView>
      );
    }

    if (screen === "jobs") {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Your jobs" action={<Pill label={`${syncedRequests.length} ACTIVE`} tone="success" />} />
          {nativeSyncStatus === "loading" ? <View style={styles.panel}><Row icon="sync-outline" title="Loading saved jobs" detail="Checking your protected HomeOS records." /></View> : syncedRequests.length ? syncedRequests.map((request) => <Press key={request.id} onPress={() => setScreen("tracking")} style={styles.activeJobCard}><View style={styles.activeJobTop}><Pill label={request.status.replaceAll("_", " ").toUpperCase()} tone="success" /><AppIcon name="chevron-forward" size={18} color={C.white} /></View><Text style={styles.activeJobTitle}>{request.category.replaceAll("_", " ")}</Text><Text style={styles.activeJobDetail}>{request.publicId} · {request.urgency} priority</Text><View style={styles.activeJobLine} /><Text style={styles.activeJobAction}>{request.description}</Text></Press>) : <View style={styles.panel}><Row icon="calendar-outline" title="No synchronised jobs" detail={nativeSyncStatus === "signin_required" ? "Sign in to load your protected HomeOS service records." : "New service requests will appear here after they are synchronised."} /></View>}
        </ScrollView>
      );
    }

    if (screen === "passport") {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Home Service Passport" action={<AppIcon name="ellipsis-horizontal" size={20} />} />
          <View style={styles.passportHero}><View><Text style={styles.passportEyebrow}>YOUR HOME RECORD</Text><Text style={styles.passportTitle}>Everything remembered.</Text><Text style={styles.passportBody}>Service, proof, invoices, and warranty protection in one secure history.</Text></View><View style={styles.passportSeal}><AppIcon name="shield-checkmark" size={27} color={C.white} /></View></View>
          <View style={styles.passportScore}><Text style={styles.metaLabel}>HOME HEALTH SCORE</Text><Text style={styles.passportScoreNumber}>{syncedHome?.healthScore ?? "—"} <Text style={styles.healthSuffix}>/ 100</Text></Text><Text style={styles.passportScoreDetail}>{syncedHome ? `Saved for ${syncedHome.label}.` : "Your score will appear after the signed-in app synchronises your saved home and service records."}</Text></View>
          <SectionTitle title="Service history" />
          <View style={styles.panel}><Row icon="document-text-outline" title="No synchronised service history yet" detail="Signed-in web service records, proof, invoices, and active warranties will appear here after native backend transport is enabled." /></View>
          <SectionTitle title="Your documents" />
          <View style={styles.panel}>{syncedDocuments.length ? syncedDocuments.map((document, index) => <View key={document.id}><Row icon="document-attach-outline" title={document.label} detail={`${document.documentType.replaceAll("_", " ")} · ${Math.ceil(document.fileSize / 1024)} KB`} />{index < syncedDocuments.length - 1 ? <View style={styles.panelLine} /> : null}</View>) : <Row icon="document-outline" title="No Passport documents synchronised" detail={nativeSyncStatus === "signin_required" ? "Sign in to upload and view protected home documents." : "Add invoices, warranty papers, installation records, and service documents."} />}</View>
          <Press onPress={choosePassportDocument} disabled={nativeDocumentUploading} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{nativeDocumentUploading ? "Securing document…" : "Add Passport document"}</Text><AppIcon name="document-attach-outline" size={18} /></Press>
          <SectionTitle title="Your appliances" />
          <View style={styles.applianceCard}><View style={styles.applianceIcon}><AppIcon name="home-outline" size={25} /></View><View style={styles.applianceCopy}><Text style={styles.rowTitle}>No appliances synchronised</Text><Text style={styles.rowDetail}>Save appliance details in your signed-in HomeOS account to build this record.</Text></View><Press onPress={() => setOnboardingVisible(true)} style={styles.roundLink}><AppIcon name="add" size={19} /></Press></View>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Account" />
        <View style={styles.profileHeader}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>S</Text></View><View><Text style={styles.profileName}>Your HomeOS account</Text><Text style={styles.profileDetail}>Homeowner · Hyderabad</Text></View></View>
        <SectionTitle title="Your home" />
        <View style={styles.panel}><Row icon="home-outline" title="Home setup" detail={syncedHome ? `${syncedHome.label} · ${syncedHome.locality}, ${syncedHome.city}` : "Address, home type, and appliances"} onPress={() => setOnboardingVisible(true)} /><View style={styles.panelLine} /><Row icon="location-outline" title="Service location" detail={syncedHome ? `${syncedHome.locality}, ${syncedHome.city}` : locationLabel} onPress={useLocation} /><View style={styles.panelLine} /><Row icon="sync-outline" title="Account synchronisation" detail={nativeSyncStatus === "ready" ? "Saved home loaded from HomeOS" : nativeSyncStatus === "loading" ? "Checking your secure session…" : nativeSyncStatus === "signin_required" ? "Sign in is required to load your HomeOS records" : "HomeOS API endpoint is unavailable"} onPress={() => void refreshNativeHome()} /></View>
        <SectionTitle title="App mode" />
        <Press onPress={() => setRole("technician")} style={styles.modeSwitch}><View style={styles.modeSwitchIcon}><AppIcon name="construct-outline" size={23} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>Open technician workspace</Text><Text style={styles.rowDetail}>Review and manage service opportunities.</Text></View><AppIcon name="arrow-forward" size={18} /></Press>
        <View style={styles.guidanceBox}><AppIcon name="information-circle-outline" size={19} color={C.moss} /><Text style={styles.guidanceText}>Notification, maps, payments, and AI diagnosis connect to secure backend services when configured for your pilot.</Text></View>
      </ScrollView>
    );
  };

  if (role === "technician") {
    return <NativeTechnicianWorkspace onBackToCustomer={() => setRole("customer")} />;
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.flex}>{renderCustomerScreen()}</View>
      {["home", "jobs", "passport", "account"].includes(screen) ? <BottomNav active={tab} onChange={changeTab} /> : null}
      <Modal transparent visible={onboardingVisible} animationType="slide" onRequestClose={() => setOnboardingVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.onboardingSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTop}><View><Text style={styles.eyebrow}>HOME SETUP</Text><Text style={styles.sheetTitle}>{homeStep === 0 ? "Set up your home" : homeStep === 1 ? "Choose home type" : "Add appliances"}</Text></View><Press onPress={() => setOnboardingVisible(false)} style={styles.headerIcon}><AppIcon name="close" size={22} /></Press></View>
            {homeStep === 0 ? <><Text style={styles.sheetBody}>Save the address you want us to care for. You can manage more homes later, including a parents’ home.</Text><TextInput value={nativeHomeAddress} onChangeText={setNativeHomeAddress} placeholder="House or building, locality" placeholderTextColor="#98958D" style={[styles.textArea, { minHeight: 54, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, backgroundColor: C.paper, marginBottom: 14 }]} /><View style={styles.locationSetup}><AppIcon name="location-outline" size={22} color={C.coral} /><View><Text style={styles.rowTitle}>{locationLabel}</Text><Text style={styles.rowDetail}>Use your current location or enter the address manually above.</Text></View></View><PrimaryButton label="Use current location" icon="location-outline" onPress={useLocation} /></> : null}
            {homeStep === 1 ? <><Text style={styles.sheetBody}>This helps us tailor maintenance recommendations and service access notes.</Text><View style={styles.homeTypeGrid}>{([['Apartment', 'apartment'], ['Independent house', 'independent_house'], ['Villa', 'villa'], ['Other', 'other']] as const).map(([homeType, value]) => <Press key={value} onPress={() => { setNativeHomeType(value); setHomeStep(2); }} style={[styles.homeTypeCard, nativeHomeType === value && { borderColor: C.forest, backgroundColor: C.sage }]}><AppIcon name={value === "apartment" ? "business-outline" : "home-outline"} size={22} /><Text style={styles.homeTypeText}>{homeType}</Text></Press>)}</View></> : null}
            {homeStep === 2 ? <><Text style={styles.sheetBody}>Save this protected home now. Appliance records can be added after the signed-in native account sync is complete.</Text><View style={styles.applianceChoice}><AppIcon name="shield-checkmark-outline" size={22} /><Text style={styles.rowTitle}>Protected home record</Text><Pill label={nativeHomeType.replaceAll("_", " ").toUpperCase()} tone="dark" /></View><PrimaryButton disabled={nativeHomeSaving} label={nativeHomeSaving ? "Saving secure home…" : "Save home setup"} icon="checkmark" onPress={saveNativeHomeSetup} /></> : null}
            {homeStep < 2 ? <Press onPress={() => setHomeStep(homeStep + 1)} style={styles.textOnlyButton}><Text style={styles.textOnlyButtonText}>{homeStep === 0 ? "Enter address manually" : "Continue"}</Text></Press> : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Timeline({ label, detail, active = false }: { label: string; detail: string; active?: boolean }) {
  return <View style={styles.timelineRow}><View style={[styles.timelineDot, active && styles.timelineDotActive]}>{active ? <AppIcon name="checkmark" size={11} color={C.white} /> : null}</View><View style={styles.timelineCopy}><Text style={[styles.timelineLabel, active && styles.timelineLabelActive]}>{label}</Text><Text style={styles.timelineDetail}>{detail}</Text></View></View>;
}

type NativeTechnicianOffer = { offer: { id: number; round: number; searchRadiusKm: number }; request: SyncedServiceRequest | null };

function NativeTechnicianWorkspace({ onBackToCustomer }: { onBackToCustomer: () => void }) {
  const [offers, setOffers] = useState<NativeTechnicianOffer[]>([]);
  const [jobs, setJobs] = useState<SyncedServiceRequest[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "signin_required">("loading");
  const [acceptingOfferId, setAcceptingOfferId] = useState<number | null>(null);

  const refresh = async () => {
    setState("loading");
    try {
      const [nextOffers, nextJobs] = await Promise.all([
        (homeosApi as any).homeos.technician.offers.query() as Promise<NativeTechnicianOffer[]>,
        (homeosApi as any).homeos.technician.jobs.query() as Promise<SyncedServiceRequest[]>,
      ]);
      setOffers(nextOffers);
      setJobs(nextJobs);
      setState("ready");
    } catch {
      setOffers([]);
      setJobs([]);
      setState("signin_required");
    }
  };

  useEffect(() => { void refresh(); }, []);

  const acceptOffer = async (offerId: number) => {
    setAcceptingOfferId(offerId);
    try {
      await (homeosApi as any).homeos.technician.acceptOffer.mutate({ offerId });
      await refresh();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Offer unavailable", "This protected offer may have already been accepted or expired. Refresh and try again.");
    } finally {
      setAcceptingOfferId(null);
    }
  };

  const declineOffer = async (offerId: number) => {
    try {
      await (homeosApi as any).homeos.technician.declineOffer.mutate({ offerId, reason: "occupied" });
      await refresh();
    } catch {
      Alert.alert("Decline unavailable", "HomeOS could not update this dispatch offer right now.");
    }
  };

  return <SafeAreaView style={styles.app}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><View style={styles.homeTopBar}><View><Text style={styles.eyebrow}>TECHNICIAN WORKSPACE</Text><Text style={styles.greeting}>Protected work queue</Text></View><Press onPress={onBackToCustomer} style={styles.avatar}><AppIcon name="swap-horizontal" size={20} color={C.forest} /></Press></View>{state === "loading" ? <View style={styles.panel}><Row icon="sync-outline" title="Loading technician records" detail="Checking protected offers and assigned jobs." /></View> : state === "signin_required" ? <View style={styles.panel}><Row icon="lock-closed-outline" title="Technician sign-in required" detail="Sign in with a verified technician account before accessing protected jobs and dispatch offers." /></View> : <><SectionTitle title="New dispatch offers" /><View style={styles.panel}>{offers.length ? offers.map((entry, index) => entry.request ? <View key={entry.offer.id}><Row icon="construct-outline" title={entry.request.category.replaceAll("_", " ")} detail={`${entry.request.publicId} · ${entry.request.urgency} priority · Round ${entry.offer.round} within ${entry.offer.searchRadiusKm} km`} />{index < offers.length - 1 ? <View style={styles.panelLine} /> : null}<View style={{ flexDirection: "row", gap: 10, padding: 15, paddingTop: 0 }}><Press onPress={() => void acceptOffer(entry.offer.id)} disabled={acceptingOfferId === entry.offer.id} style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.secondaryButtonText}>{acceptingOfferId === entry.offer.id ? "Accepting…" : "Accept"}</Text></Press><Press onPress={() => void declineOffer(entry.offer.id)} style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.secondaryButtonText}>Decline</Text></Press></View></View> : null) : <Row icon="briefcase-outline" title="No live offers" detail="Verified offers matching your availability and skills will appear here." />}</View><SectionTitle title="Assigned work" /><View style={styles.panel}>{jobs.length ? jobs.map((job, index) => <View key={job.id}><Row icon="clipboard-outline" title={job.category.replaceAll("_", " ")} detail={`${job.publicId} · ${job.status.replaceAll("_", " ")} · ${job.urgency} priority`} />{index < jobs.length - 1 ? <View style={styles.panelLine} /> : null}</View>) : <Row icon="calendar-outline" title="No assigned jobs" detail="Accepted protected offers will appear here." />}</View><Press onPress={() => void refresh()} style={styles.textOnlyButton}><Text style={styles.textOnlyButtonText}>Refresh protected work queue</Text></Press></>}</ScrollView></SafeAreaView>;
}

function TechnicianWorkspace({ onBackToCustomer, onOpenCustomerJob }: { onBackToCustomer: () => void; onOpenCustomerJob: () => void }) {
  const [techStage, setTechStage] = useState<"feed" | "job" | "quote" | "complete">("feed");
  const [accepted, setAccepted] = useState(false);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const addServiceProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo permission needed", "Allow photo-library access to add before, part, or after proof.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!result.canceled) {
      setProofUri(result.assets[0]?.uri ?? null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.homeTopBar}><View><Text style={styles.eyebrow}>TECHNICIAN WORKSPACE</Text><Text style={styles.greeting}>{techStage === "feed" ? "Today’s jobs" : techStage === "job" ? "Job details" : techStage === "quote" ? "Create quote" : "Wrap up work"}</Text></View><Press onPress={onBackToCustomer} style={styles.avatar}><AppIcon name="swap-horizontal" size={20} color={C.forest} /></Press></View>
        {techStage === "feed" ? <><View style={styles.techEarnings}><View><Text style={styles.metaLabel}>TODAY</Text><Text style={styles.earningsAmount}>Earnings update after confirmed jobs</Text></View><Pill label="AVAILABLE" tone="success" /></View><SectionTitle title="New opportunity" /><View style={styles.newJobCard}><View style={styles.newJobTop}><Pill label="AC & APPLIANCES" tone="dark" /><Text style={styles.newJobDistance}>2.1 km</Text></View><Text style={styles.newJobTitle}>AC is running but not cooling</Text><Text style={styles.newJobDetail}>Kondapur · Estimated visit and repair range available after diagnosis</Text><View style={styles.newJobMeta}><Text style={styles.newJobMetaText}>Skill: AC cooling</Text><Text style={styles.newJobMetaText}>Estimated time: 30–60 min</Text></View><PrimaryButton label="Review job" icon="arrow-forward" onPress={() => setTechStage("job")} /></View><SectionTitle title="Your business" /><View style={styles.panel}><Row icon="wallet-outline" title="Earnings" detail="Payment records after job confirmation" /><View style={styles.panelLine} /><Row icon="people-outline" title="Customers" detail="Service history and approved follow-ups" /><View style={styles.panelLine} /><Row icon="stats-chart-outline" title="Performance" detail="Completion, on-time, and warranty performance" /></View></> : null}
        {techStage === "job" ? <><View style={styles.newJobCard}><Pill label="NEW JOB" tone="warm" /><Text style={styles.newJobTitle}>AC is running but not cooling</Text><Text style={styles.newJobDetail}>Customer issue: “My AC is not cooling well.”</Text><View style={styles.newJobMeta}><Text style={styles.newJobMetaText}>Distance · 2.1 km</Text><Text style={styles.newJobMetaText}>Required skill · AC cooling</Text></View><View style={styles.guidanceBox}><AppIcon name="shield-checkmark-outline" size={19} color={C.success} /><Text style={styles.guidanceText}>Review the work scope and accept only if you are qualified and available.</Text></View></View>{accepted ? <PrimaryButton label="Navigate to customer" icon="navigate-outline" onPress={onOpenCustomerJob} /> : <PrimaryButton label="Accept job" icon="checkmark" onPress={() => setAccepted(true)} />}<Press onPress={() => { setAccepted(false); setTechStage("feed"); }} style={styles.textOnlyButton}><Text style={styles.textOnlyButtonText}>Decline — not available</Text></Press>{accepted ? <PrimaryButton label="Start diagnosis" icon="construct-outline" onPress={() => setTechStage("quote")} /> : null}</> : null}
        {techStage === "quote" ? <><Text style={styles.flowTitle}>Send an itemised quote.</Text><Text style={styles.flowSubtitle}>Explain the problem, list labour and parts, then wait for customer approval. Work cannot start before approval.</Text><View style={styles.quotePanel}><View style={styles.billLine}><Text style={styles.billLabel}>Visit fee</Text><Text style={styles.billAmount}>{formatIndianRupees(199)}</Text></View><View style={styles.billLine}><Text style={styles.billLabel}>Labour</Text><Text style={styles.billAmount}>{formatIndianRupees(300)}</Text></View><View style={styles.billLine}><Text style={styles.billLabel}>Part: capacitor</Text><Text style={styles.billAmount}>{formatIndianRupees(450)}</Text></View></View><View style={styles.hardGate}><AppIcon name="lock-closed-outline" size={20} color={C.coral} /><View style={styles.hardGateCopy}><Text style={styles.hardGateTitle}>Customer approval gate</Text><Text style={styles.hardGateText}>The customer must approve the current quote before this repair can start.</Text></View></View><PrimaryButton label="Send quote for approval" icon="paper-plane-outline" onPress={() => { Alert.alert("Quote sent", "The customer must approve the quote before work can begin."); setTechStage("complete"); }} /></> : null}
        {techStage === "complete" ? <><View style={styles.approvedState}><AppIcon name="information-circle-outline" size={24} color={C.gold} /><View><Text style={styles.approvedTitle}>Awaiting customer approval</Text><Text style={styles.approvedText}>Once the quote is approved, add proof and ask the customer for the completion OTP.</Text></View></View><View style={styles.newJobCard}><Text style={styles.newJobTitle}>Complete securely</Text><Text style={styles.newJobDetail}>Add before/after proof and service notes. The job cannot be marked completed without the customer’s OTP.</Text>{proofUri ? <Image source={{ uri: proofUri }} style={styles.techProofImage} /> : <View style={styles.techProofEmpty}><AppIcon name="images-outline" size={25} color={C.coral} /><Text style={styles.techProofEmptyText}>No proof added yet</Text></View>}<Press onPress={addServiceProof} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{proofUri ? "Replace service proof" : "Add service proof"}</Text><AppIcon name="camera-outline" size={18} /></Press><Text style={styles.proofSecurityText}>When the secure mobile-client connection is configured, this proof is uploaded to the protected service record.</Text></View></> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.cream }, flex: { flex: 1 }, scrollContent: { padding: 20, paddingBottom: 108 }, flowContent: { padding: 20, paddingBottom: 42 }, pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] }, disabled: { opacity: 0.5 },
  homeTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }, eyebrow: { color: C.coral, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" }, greeting: { color: C.ink, fontSize: 28, letterSpacing: -0.8, fontWeight: "700", marginTop: 4 }, avatar: { height: 44, width: 44, borderRadius: 22, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }, avatarText: { color: C.forest, fontWeight: "800", fontSize: 16 }, locationLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 }, locationText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  heroCard: { marginTop: 24, borderRadius: 28, padding: 24, minHeight: 255, overflow: "hidden" }, heroGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "#4D846F", opacity: 0.35, right: -72, top: -65 }, pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 }, pillNeutral: { backgroundColor: "#ECE8E0" }, pillSuccess: { backgroundColor: "#DCEFE5" }, pillWarm: { backgroundColor: "#FBE8DE" }, pillDark: { backgroundColor: "rgba(255,255,255,0.16)" }, pillText: { color: C.forest, fontSize: 10, letterSpacing: 0.7, fontWeight: "800" }, pillTextDark: { color: C.white, fontSize: 10, letterSpacing: 0.7, fontWeight: "800" }, heroTitle: { color: C.white, fontSize: 32, lineHeight: 36, letterSpacing: -1.1, fontWeight: "700", marginTop: 18 }, heroBody: { color: "#D5E4DA", fontSize: 14, lineHeight: 21, width: "82%", marginTop: 10 }, heroCta: { position: "absolute", left: 24, right: 24, bottom: 22, minHeight: 53, borderRadius: 18, backgroundColor: C.white, paddingLeft: 18, paddingRight: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroCtaText: { color: C.forest, fontSize: 15, fontWeight: "800" }, heroCtaIcon: { height: 36, width: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.sage },
  homeHealth: { marginTop: 17, borderRadius: 22, backgroundColor: C.paper, padding: 15, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.line }, healthOrb: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.sage, alignItems: "center", justifyContent: "center", flexDirection: "row" }, healthNumber: { fontSize: 22, color: C.forest, fontWeight: "800" }, healthSuffix: { fontSize: 12, color: C.muted, fontWeight: "700" }, healthCopy: { flex: 1, marginLeft: 13 }, healthLabel: { color: C.ink, fontWeight: "800", fontSize: 15 }, healthDetail: { color: C.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }, roundLink: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cream, alignItems: "center", justifyContent: "center" },
  homeActiveJob: { marginTop: 13, backgroundColor: "#275C4A", borderRadius: 21, padding: 15 }, homeActiveJobTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, homeActiveJobEta: { color: "#D4E5D9", fontSize: 11, fontWeight: "800" }, homeActiveJobBody: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 13 }, homeActiveJobIcon: { width: 41, height: 41, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }, homeActiveJobTitle: { color: C.white, fontSize: 14, fontWeight: "900" }, homeActiveJobDetail: { color: "#D4E5D9", fontSize: 11, marginTop: 3 },
  sectionTitleRow: { marginTop: 28, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: C.ink, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }, sectionAction: { color: C.coral, fontSize: 12, fontWeight: "800" }, serviceRail: { gap: 11, paddingRight: 20 }, serviceCard: { width: 94, minHeight: 92, borderRadius: 19, padding: 12, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, justifyContent: "space-between" }, serviceIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: C.cream, alignItems: "center", justifyContent: "center" }, serviceLabel: { color: C.ink, fontWeight: "700", fontSize: 12, lineHeight: 16 }, panel: { backgroundColor: C.paper, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: "hidden" }, rowPress: { backgroundColor: C.paper }, row: { flexDirection: "row", alignItems: "center", padding: 15, gap: 12 }, rowIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.cream, alignItems: "center", justifyContent: "center" }, rowCopy: { flex: 1 }, rowTitle: { color: C.ink, fontSize: 14, fontWeight: "800" }, rowDetail: { color: C.muted, fontSize: 12, marginTop: 3, lineHeight: 16 }, panelLine: { height: 1, backgroundColor: C.line, marginLeft: 65 }, safetyNote: { flexDirection: "row", gap: 9, padding: 14, marginTop: 18, backgroundColor: "#E7EFE7", borderRadius: 17 }, safetyText: { flex: 1, color: C.moss, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  bottomNav: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, borderColor: C.line, paddingTop: 11, paddingBottom: Platform.OS === "ios" ? 15 : 10, backgroundColor: "rgba(255,253,249,0.92)" }, tabPress: { minWidth: 60, alignItems: "center", gap: 4 }, tabLabel: { color: C.muted, fontSize: 10, fontWeight: "700" }, tabLabelActive: { color: C.coral },
  screenHeader: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, headerIcon: { height: 38, width: 38, borderRadius: 14, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }, headerIconPlaceholder: { height: 38, width: 38 }, screenTitle: { color: C.ink, fontSize: 16, fontWeight: "800" }, headerAction: { minWidth: 38, alignItems: "flex-end" }, flowTitle: { color: C.ink, fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: "800", marginTop: 14 }, flowSubtitle: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 22 }, centered: { textAlign: "center" }, inputPanel: { borderRadius: 21, backgroundColor: C.paper, padding: 16, borderWidth: 1, borderColor: C.line }, inputLabel: { color: C.ink, fontSize: 13, fontWeight: "800", marginBottom: 8 }, textArea: { minHeight: 125, fontSize: 15, lineHeight: 22, color: C.ink, textAlignVertical: "top" }, inputBottom: { paddingTop: 12, borderTopWidth: 1, borderColor: C.line, flexDirection: "row", justifyContent: "space-between" }, inputHint: { color: C.muted, fontSize: 12, fontWeight: "600" }, attachmentCard: { minHeight: 88, backgroundColor: C.paper, borderWidth: 1, borderStyle: "dashed", borderColor: "#BFB6A8", borderRadius: 19, marginTop: 14, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }, attachmentIcon: { width: 47, height: 47, borderRadius: 15, backgroundColor: "#FBE8DE", alignItems: "center", justifyContent: "center" }, attachmentImage: { width: 47, height: 47, borderRadius: 15 }, attachmentCopy: { flex: 1 }, attachmentTitle: { color: C.ink, fontSize: 14, fontWeight: "800" }, attachmentText: { color: C.muted, fontSize: 12, lineHeight: 16, marginTop: 3 }, guidanceBox: { flexDirection: "row", gap: 10, padding: 14, backgroundColor: C.paper, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginTop: 17 }, guidanceText: { flex: 1, color: C.moss, fontSize: 12, lineHeight: 18, fontWeight: "600" }, stickyAction: { padding: 18, backgroundColor: "rgba(247,244,238,0.97)", borderTopWidth: 1, borderColor: C.line }, primaryButton: { borderRadius: 17, overflow: "hidden" }, primaryGradient: { minHeight: 54, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, primaryButtonText: { color: C.white, fontSize: 14, fontWeight: "800" },
  questionCard: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 21, padding: 17, marginBottom: 12 }, questionNumber: { color: C.coral, fontWeight: "900", fontSize: 11, letterSpacing: 1.2 }, questionText: { color: C.ink, fontSize: 16, lineHeight: 22, fontWeight: "700", marginTop: 9 }, choiceRow: { flexDirection: "row", gap: 8, marginTop: 16 }, analysisCard: { backgroundColor: C.forest, padding: 20, borderRadius: 23, marginTop: 10 }, analysisTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 }, sparkBadge: { height: 31, width: 31, borderRadius: 10, backgroundColor: C.coral, alignItems: "center", justifyContent: "center" }, analysisHeading: { color: C.white, fontSize: 14, fontWeight: "800" }, analysisDiagnosis: { color: C.white, fontSize: 21, lineHeight: 28, fontWeight: "800", marginTop: 16 }, analysisBody: { color: "#C9DCD0", fontSize: 13, lineHeight: 19, marginTop: 7 }, analysisMeta: { flexDirection: "row", marginTop: 19, paddingTop: 15, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.16)", gap: 14 }, metaLabel: { color: C.muted, fontSize: 9, letterSpacing: 0.8, fontWeight: "900" }, metaValue: { color: C.white, fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 5, maxWidth: 145 }, metaDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" }, estimateCard: { marginVertical: 17, backgroundColor: "#F1E9DD", padding: 18, borderRadius: 21 }, estimateTitle: { color: C.forest, fontSize: 13, fontWeight: "800" }, estimatePrice: { color: C.ink, fontSize: 27, fontWeight: "800", letterSpacing: -0.8, marginTop: 7 }, estimateNote: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  modeRail: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }, matchCard: { backgroundColor: C.paper, borderRadius: 23, padding: 17, borderWidth: 1, borderColor: C.line, marginBottom: 13 }, matchCardSelected: { borderColor: C.forest, borderWidth: 1.5 }, matchTop: { flexDirection: "row", alignItems: "center", gap: 10 }, techAvatar: { width: 49, height: 49, borderRadius: 16, backgroundColor: "#E7D6C3", alignItems: "center", justifyContent: "center" }, techInitials: { color: C.forest, fontSize: 15, fontWeight: "900" }, matchName: { flex: 1 }, matchPerson: { color: C.ink, fontSize: 15, fontWeight: "800" }, matchSpecialty: { color: C.muted, fontSize: 11, marginTop: 3, lineHeight: 15 }, matchStats: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 15, marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line }, matchMetric: { color: C.ink, fontSize: 11, marginTop: 5, fontWeight: "800", maxWidth: 100 }, matchFoot: { color: C.muted, fontSize: 12, lineHeight: 18, marginVertical: 14 }, secondaryButton: { borderRadius: 16, minHeight: 49, paddingHorizontal: 16, backgroundColor: C.cream, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, secondaryButtonText: { color: C.forest, fontWeight: "800", fontSize: 13 }, disclaimer: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4, textAlign: "center" },
  trackingHeader: { alignItems: "center", marginBottom: 18 }, trackingTime: { color: C.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.7, marginTop: 12 }, trackingAddress: { color: C.muted, fontSize: 12, marginTop: 5 }, mapFrame: { height: 270, backgroundColor: "#E5ECE5", borderRadius: 24, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: "#D4DDD3" }, mapGrid: { position: "absolute", inset: 0, opacity: 0.45, backgroundColor: "#DCE7D8" }, mapRoad: { position: "absolute", backgroundColor: C.paper, borderColor: "#D1D8CD", borderWidth: 1 }, roadOne: { height: 45, width: 390, top: 100, left: -40, transform: [{ rotate: "-18deg" }] }, roadTwo: { height: 38, width: 330, top: 160, left: 15, transform: [{ rotate: "35deg" }] }, routeLine: { position: "absolute", width: 175, height: 4, backgroundColor: C.coral, top: 126, left: 80, transform: [{ rotate: "24deg" }], borderRadius: 10 }, homePin: { position: "absolute", height: 39, width: 39, borderRadius: 15, backgroundColor: C.forest, alignItems: "center", justifyContent: "center", top: 76, right: 43, borderWidth: 4, borderColor: C.white }, techPin: { position: "absolute", height: 39, width: 39, borderRadius: 15, backgroundColor: C.coral, alignItems: "center", justifyContent: "center", bottom: 64, left: 58, borderWidth: 4, borderColor: C.white }, mapLegend: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 7, left: 12, right: 12, bottom: 12, padding: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.92)" }, legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral }, legendText: { color: C.moss, fontSize: 10, lineHeight: 14, flex: 1, fontWeight: "600" }, techSummary: { padding: 16, marginTop: 13, borderRadius: 21, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", gap: 12 }, techSummaryCopy: { flex: 1 }, contactButton: { height: 39, width: 39, borderRadius: 13, backgroundColor: C.cream, alignItems: "center", justifyContent: "center" }, timeline: { marginVertical: 20 }, timelineRow: { flexDirection: "row", gap: 13, minHeight: 62 }, timelineDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#E3E0D8", alignItems: "center", justifyContent: "center" }, timelineDotActive: { backgroundColor: C.success }, timelineCopy: { flex: 1, paddingBottom: 14, borderLeftWidth: 1, borderColor: C.line, paddingLeft: 13, marginLeft: -24 }, timelineLabel: { color: C.ink, fontSize: 13, fontWeight: "800" }, timelineLabelActive: { color: C.success }, timelineDetail: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  quotePanel: { backgroundColor: C.paper, borderRadius: 22, padding: 17, borderWidth: 1, borderColor: C.line }, quoteReason: { color: C.ink, fontSize: 14, fontWeight: "800", paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line, marginBottom: 6 }, billLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 }, billLabel: { color: C.muted, fontSize: 13 }, billAmount: { color: C.ink, fontSize: 13, fontWeight: "700" }, billTotal: { color: C.ink, fontSize: 15, fontWeight: "900" }, hardGate: { flexDirection: "row", gap: 11, padding: 15, borderRadius: 19, backgroundColor: "#FCECE6", marginVertical: 17 }, hardGateCopy: { flex: 1 }, hardGateTitle: { color: "#9E3B27", fontSize: 13, fontWeight: "900" }, hardGateText: { color: "#A5503E", fontSize: 12, lineHeight: 17, marginTop: 4 }, approvedState: { flexDirection: "row", gap: 11, padding: 15, borderRadius: 19, backgroundColor: "#E5F1E8", marginBottom: 12 }, approvedTitle: { color: C.success, fontWeight: "900", fontSize: 13 }, approvedText: { color: C.moss, fontSize: 12, lineHeight: 17, marginTop: 4, flexShrink: 1 }, textOnlyButton: { alignItems: "center", paddingVertical: 18 }, textOnlyButtonText: { color: C.coral, fontSize: 13, fontWeight: "800" },
  otpContent: { flex: 1, padding: 20, alignItems: "center" }, otpIcon: { height: 68, width: 68, borderRadius: 23, backgroundColor: "#FCE8DF", alignItems: "center", justifyContent: "center", marginTop: 16 }, otpInput: { width: "100%", backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, fontSize: 22, letterSpacing: 4, textAlign: "center", color: C.ink, fontWeight: "800", paddingVertical: 15, marginTop: 10 }, payMethod: { minHeight: 60, paddingHorizontal: 14, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 10 }, payMethodSelected: { borderColor: C.coral, borderWidth: 1.5 }, payMethodIcon: { height: 34, width: 34, borderRadius: 11, backgroundColor: C.cream, alignItems: "center", justifyContent: "center" }, payMethodText: { color: C.ink, fontSize: 14, fontWeight: "800", flex: 1 }, radioEmpty: { width: 20, height: 20, borderRadius: 10, borderColor: C.line, borderWidth: 2 },
  completeBadge: { width: 67, height: 67, borderRadius: 33.5, backgroundColor: C.success, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 12 }, invoiceCard: { backgroundColor: C.paper, borderRadius: 23, padding: 18, marginVertical: 24, borderWidth: 1, borderColor: C.line }, invoiceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 17, borderBottomWidth: 1, borderColor: C.line }, invoiceBrand: { color: C.coral, fontSize: 10, letterSpacing: 1.5, fontWeight: "900" }, invoiceTitle: { color: C.ink, fontSize: 20, fontWeight: "900", marginTop: 4 }, invoiceMeta: { paddingVertical: 15, gap: 5 }, invoiceMetaValue: { color: C.ink, fontSize: 12, fontWeight: "700", marginBottom: 6 }, warrantyInvoice: { flexDirection: "row", gap: 11, backgroundColor: "#E8F2E9", padding: 13, borderRadius: 16, marginTop: 16 }, warrantyInvoiceTitle: { color: C.success, fontSize: 13, fontWeight: "900" }, warrantyInvoiceText: { color: C.moss, fontSize: 11, lineHeight: 16, marginTop: 3 },
  activeJobCard: { backgroundColor: C.forest, borderRadius: 24, padding: 19, marginTop: 5 }, activeJobTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, activeJobTitle: { color: C.white, fontSize: 21, fontWeight: "800", marginTop: 21 }, activeJobDetail: { color: "#CEE0D3", fontSize: 12, marginTop: 5 }, activeJobLine: { height: 1, backgroundColor: "rgba(255,255,255,0.16)", marginVertical: 14 }, activeJobAction: { color: C.white, fontSize: 12, fontWeight: "800" }, passportHero: { backgroundColor: C.forest, borderRadius: 25, padding: 20, minHeight: 193, flexDirection: "row", overflow: "hidden" }, passportEyebrow: { color: "#BDD6C6", letterSpacing: 1.2, fontWeight: "800", fontSize: 10 }, passportTitle: { color: C.white, fontSize: 27, lineHeight: 33, letterSpacing: -0.8, fontWeight: "800", marginTop: 8 }, passportBody: { color: "#C7DBCE", fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: 235 }, passportSeal: { height: 52, width: 52, borderRadius: 18, backgroundColor: C.coral, alignItems: "center", justifyContent: "center", position: "absolute", right: 17, bottom: 17 }, passportScore: { padding: 18, borderRadius: 21, backgroundColor: "#EEE7DA", marginTop: 14 }, passportScoreNumber: { color: C.forest, fontSize: 33, fontWeight: "900", marginTop: 4 }, passportScoreDetail: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }, applianceCard: { backgroundColor: C.paper, padding: 15, borderRadius: 21, borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", gap: 12 }, applianceIcon: { height: 48, width: 48, borderRadius: 16, backgroundColor: C.cream, alignItems: "center", justifyContent: "center" }, applianceCopy: { flex: 1 },
  profileHeader: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 17, flexDirection: "row", alignItems: "center", gap: 13 }, profileAvatar: { width: 55, height: 55, borderRadius: 19, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }, profileInitial: { color: C.forest, fontSize: 19, fontWeight: "900" }, profileName: { color: C.ink, fontSize: 16, fontWeight: "800" }, profileDetail: { color: C.muted, fontSize: 12, marginTop: 4 }, modeSwitch: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }, modeSwitchIcon: { height: 46, width: 46, borderRadius: 15, backgroundColor: "#FBE8DE", alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20,37,31,0.42)" }, onboardingSheet: { backgroundColor: C.cream, borderTopLeftRadius: 29, borderTopRightRadius: 29, padding: 20, paddingBottom: 34, minHeight: 420 }, sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#C6C0B6", marginBottom: 17 }, sheetTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, sheetTitle: { color: C.ink, fontSize: 26, fontWeight: "800", letterSpacing: -0.7, marginTop: 4 }, sheetBody: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 16, marginBottom: 20 }, locationSetup: { flexDirection: "row", gap: 11, padding: 15, borderRadius: 18, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, marginBottom: 17 }, homeTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, homeTypeCard: { width: "47%", minHeight: 92, backgroundColor: C.paper, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, justifyContent: "space-between" }, homeTypeText: { color: C.ink, fontSize: 13, fontWeight: "800" }, applianceChoice: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  techEarnings: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#E6EEE6", padding: 16, borderRadius: 20, marginTop: 23 }, earningsAmount: { color: C.forest, fontSize: 14, fontWeight: "800", marginTop: 4 }, newJobCard: { backgroundColor: C.paper, borderRadius: 23, padding: 18, borderWidth: 1, borderColor: C.line }, newJobTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, newJobDistance: { color: C.muted, fontSize: 12, fontWeight: "800" }, newJobTitle: { color: C.ink, fontSize: 19, lineHeight: 25, fontWeight: "800", marginTop: 15 }, newJobDetail: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, newJobMeta: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingVertical: 15, marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, marginBottom: 15 }, newJobMetaText: { color: C.forest, fontSize: 11, fontWeight: "800", flex: 1 },
  techProofImage: { width: "100%", height: 150, borderRadius: 16, marginBottom: 12, marginTop: 16 }, techProofEmpty: { height: 104, marginTop: 16, marginBottom: 12, borderWidth: 1, borderStyle: "dashed", borderColor: "#C5BEB2", borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: C.cream }, techProofEmptyText: { color: C.muted, fontSize: 12, fontWeight: "700" }, proofSecurityText: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 12 },
});
