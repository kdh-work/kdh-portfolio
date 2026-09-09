import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/sections/Hero";
import { CareerSummary } from "@/components/sections/CareerSummary";
import { MatrixPreview } from "@/components/sections/MatrixPreview";
import { CaseStudy } from "@/components/sections/CaseStudy";
import { IsoMapPreview } from "@/components/sections/IsoMapPreview";
import { WorkProjects } from "@/components/sections/WorkProjects";
import { PersonalProjects } from "@/components/sections/PersonalProjects";
import { TechStack } from "@/components/sections/TechStack";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <CareerSummary />
        <MatrixPreview />
        <CaseStudy />
        <IsoMapPreview />
        <WorkProjects />
        <PersonalProjects />
        <TechStack />
      </main>
      <SiteFooter />
    </>
  );
}
