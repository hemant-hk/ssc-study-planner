import type { Metadata } from 'next'
import { AssessmentWizard } from '@/components/assessment/AssessmentWizard'

export const metadata: Metadata = {
  title: 'Assessment',
  description:
    'Answer 24 questions about your digital habits to calculate your Privacy Footprint Score — processed entirely in your browser.',
}

export default function AssessmentPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <AssessmentWizard />
    </div>
  )
}
