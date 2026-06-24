import { Separator } from "@/components/ui/separator"

export const StepperActionHeader = ({ title, Stepper }: { title: string, Stepper: any }) => {
  return (
    <>
      <div className="my-4 flex justify-between items-center">
        <h2 className="line-clamp-2 text-xl font-semibold tracking-tight">
          {title}
        </h2>

        <div className="flex justify-between gap-4 text-mono">
          <Stepper.Prev className="btn-sec">
            Back
          </Stepper.Prev>

          <Stepper.Next className="btn-pri">
            Next
          </Stepper.Next>
        </div>
      </div>

      <Separator className="mb-8 bg-border" />
    </>
  )
}