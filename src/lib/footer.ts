import { APP } from "./app.config";

export interface FooterConfig {
  schoolName: string;
  schoolYear: string;
  poweredBy: string;
  poweredByUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  uploadUrl: string;
  githubUrl: string;
  developerName: string;
  developerUrl: string;
  developerInstagramUrl: string;
  developerLinkedinUrl: string;
}

declare const __FOOTER_CONFIG__: FooterConfig;

const DEFAULT_FOOTER: FooterConfig = {
  schoolName: APP.name,
  schoolYear: new Date().getFullYear().toString(),
  poweredBy: "",
  poweredByUrl: "#",
  instagramUrl: "",
  youtubeUrl: "",
  uploadUrl: "",
  githubUrl: "",
  developerName: "",
  developerUrl: "",
  developerInstagramUrl: "",
  developerLinkedinUrl: "",
};

export const FOOTER: FooterConfig =
  typeof __FOOTER_CONFIG__ !== "undefined" ? __FOOTER_CONFIG__ : DEFAULT_FOOTER;
