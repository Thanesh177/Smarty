// Public exam references checked 2026-11-25. Original practice only; never dumps.
// This allowlist is shared by the website and the quiz worker.
export const EXAM_BLUEPRINTS = [
  {
    id: 'ielts-academic-reading', title: 'IELTS Academic', code: 'Reading skills', version: 'reading-2026-11-hypothetical-v2',
    provider: 'IELTS', area: 'English', passageRequired: true,
    description: 'Read original passages, identify evidence and distinguish what is stated from what is assumed.',
    coverage: 'Reading skills only. This does not assess listening, writing or speaking, simulate the full Reading test, or predict an IELTS band.',
    url: 'https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading',
    domains: [
      { id: 'main-idea', title: 'Main ideas and purpose', focus: 'Identify the main idea, purpose and scope of an original non-specialist reading passage. Base every answer on the passage.' },
      { id: 'evidence', title: 'Details and supporting evidence', focus: 'Find explicit details, resolve paraphrases and distinguish evidence from an unsupported inference in an original reading passage.' },
      { id: 'inference', title: 'Claims and careful inference', focus: 'Distinguish a supported inference from a contradiction or information not supplied. Include an original passage and quote the relevant evidence.' },
    ],
  },
  {
    id: 'terraform-associate-004', title: 'Terraform Associate', code: '004', version: '004-2026-11',
    provider: 'HashiCorp', area: 'Infrastructure',
    studyNotes: 'Terraform configuration describes desired infrastructure. State maps configuration addresses to managed remote objects and records relevant attributes. Terraform plan proposes changes; apply executes changes. State locking coordinates operations that write state when the configured backend supports it; not all backends support locking. Locking is not encryption and does not replace access controls. Marking a variable or output sensitive hides it from ordinary display, but its value can still be stored in state. The sensitive flag does not encrypt state or make it safe to commit to Git. Protect state storage with appropriate encryption, access controls and backups. Remote storage alone is not a security guarantee. A module packages reusable configuration with inputs and outputs. Provider constraints specify permitted selections; the dependency lock file records selected provider versions and checksums. Drift is a difference between configuration and actual infrastructure. Refreshing discovered values does not rewrite desired configuration. Always review changes before applying them.',
    description: 'Reason about infrastructure as code, the plan/apply workflow, state, modules and collaboration.',
    coverage: 'Conceptual, single-answer practice for selected 004 objectives. Not a complete mock exam or a replacement for hands-on Terraform practice.',
    url: 'https://developer.hashicorp.com/certifications/terraform-associate',
    domains: [
      { id: 'workflow', title: 'Infrastructure and core workflow', focus: 'Infrastructure as code and the roles of terraform init, validate, plan and apply. Distinguish a proposed plan from an executed change.' },
      { id: 'state', title: 'State and collaboration', focus: 'State maps configuration to managed objects. State locking, remote backends, sensitive state and drift. Never include real credentials.' },
      { id: 'configuration', title: 'Providers, variables and modules', focus: 'Provider version constraints, dependency lock files, reusable modules, inputs, outputs and references.' },
      { id: 'lifecycle', title: 'Change and lifecycle reasoning', focus: 'Reason about dependencies, replacement, safe refactoring and limitations of lifecycle settings. Use only hypothetical configuration, never execute it.' },
    ],
  },
  {
    id: 'security-plus-701', title: 'CompTIA Security+', code: 'SY0-701', version: '701-2026-11',
    provider: 'CompTIA', area: 'Cybersecurity',
    studyNotes: 'Authentication establishes identity; authorization determines permitted actions. Least privilege grants only the operations and resources needed for an authorized task. Two uses of the same authentication factor are not independent factors. Phishing imitates trusted messages or services to obtain information or provoke unsafe actions. Verify suspicious requests through an independently trusted channel. Encryption is reversible with appropriate keys; hashing is not encryption. Password verification should use a suitable salted, deliberately costly password-hashing algorithm, not Base64 or a fast unsalted general hash. Segmentation needs enforced traffic rules, not merely network names. An alert is a signal to investigate, not conclusive proof of an incident. Containment limits harm while considering evidence and operational impact. Restoring a backup does not by itself remove the original compromise path. Risk assessments consider threats, vulnerabilities, likelihood and impact; compliance alone is not proof that a control is effective.',
    description: 'Practise defensive security decisions, threats, architecture, operations and governance.',
    coverage: 'Selected SY0-701 concepts. Single-answer questions do not reproduce performance-based tasks or demonstrate job or exam readiness. Check the provider for available exam versions.',
    url: 'https://assets.ctfassets.net/82ripq7fjls2/6TYWUym0Nudqa8nGEnegjG/0f9b974d3b1837fe85ab8e6553f4d623/CompTIA-Security-Plus-SY0-701-Exam-Objectives.pdf',
    domains: [
      { id: 'principles', title: 'Security principles', focus: 'Confidentiality, integrity, availability, least privilege, authentication, authorization, encryption and hashing.' },
      { id: 'threats', title: 'Threats and mitigations', focus: 'Recognize phishing and common vulnerability categories. Choose defensive mitigation under explicit constraints; no offensive instructions.' },
      { id: 'architecture', title: 'Secure architecture', focus: 'Segmentation, defense in depth, resilience and secure architecture trade-offs.' },
      { id: 'operations', title: 'Security operations', focus: 'Monitoring, triage, incident containment, evidence preservation and recovery. State assumptions when ordering actions.' },
      { id: 'governance', title: 'Risk and governance', focus: 'Risk assessment, policies, third-party risk and distinguishing control effectiveness from compliance. Avoid changing legal requirements.' },
    ],
  },
  {
    id: 'aws-cloud-practitioner', title: 'AWS Cloud Practitioner', code: 'CLF-C02', version: 'clf-c02-2026-11',
    provider: 'AWS', area: 'Cloud',
    studyNotes: 'Elasticity adjusts resources to changing demand. High availability requires deliberate redundancy and failure handling; multiple Availability Zones reduce dependence on one zone when the application is designed appropriately. Scaling one tier does not remove a bottleneck in another tier. AWS secures the underlying cloud infrastructure; customers still configure appropriate access and protect their data. EC2 customers normally manage the guest operating system and installed software. A managed service shifts specified operational tasks, not all customer responsibilities. IAM governs identities and permissions. An appropriately scoped role supplies temporary credentials to a workload without embedding long-lived access keys. Amazon S3 is object storage, EC2 provides virtual compute, Lambda executes event-driven code subject to workload limits, and Route 53 provides DNS-related capabilities. Usage-based billing does not guarantee low cost. Rightsizing, budgets and measuring actual usage support cost control. Do not invent current prices, support-plan features or purchasing commitments.',
    description: 'Build cloud literacy through shared responsibility, service choices, resilience and cost reasoning.',
    coverage: 'Selected CLF-C02 concepts, using original single-answer questions. Not a full mock exam, official question set or predicted passing score.',
    url: 'https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/',
    domains: [
      { id: 'cloud', title: 'Cloud concepts', focus: 'Elasticity, scalability, availability, cloud value and the reasons for managed services.' },
      { id: 'security', title: 'Security and responsibility', focus: 'Shared responsibility, least privilege and identity management. Distinguish customer and provider responsibilities for a named service.' },
      { id: 'services', title: 'Technology and services', focus: 'Choose between foundational compute, object storage and managed database services based on stated requirements.' },
      { id: 'cost', title: 'Cost and support reasoning', focus: 'Usage-based cost, resource rightsizing, budgets and matching purchasing options to workload predictability. Do not invent prices or current plan features.' },
    ],
  },
];

export function resolveExamTrack(id, domainId) {
  const exam = EXAM_BLUEPRINTS.find(item => item.id === id);
  if (!exam) return null;
  const domain = domainId ? exam.domains.find(item => item.id === domainId) : null;
  if (domainId && !domain) return null;
  return { exam, domain };
}
