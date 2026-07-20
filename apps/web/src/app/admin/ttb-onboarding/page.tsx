import { TTBOnboardingWizard } from "@/components/admin/ttb-onboarding/TTBOnboardingWizard";

export const metadata = {
  title: "TTB Initial Setup | CiderPilot",
  description: "Set up your TTB reconciliation for accurate inventory tracking",
};

export default function TTBOnboardingPage() {
  return <TTBOnboardingWizard />;
}
