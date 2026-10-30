import { useState } from "react";
import { toast } from "sonner";
import { createRequestSchema } from "@bluelearn/schemas";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTodo } from "@/lib/api/todos";

type PropTypes = {
  Stepper: any;
  onSubmitted?: () => void;
};

type RequestStatus = "idle" | "submitting" | "success" | "error";

export const GuideRequestDetails = ({ Stepper, onSubmitted }: PropTypes) => {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const submitRequest = async () => {
    if (status === "submitting" || status === "success") {
      return;
    }

    const parsed = createRequestSchema.safeParse({
      title,
      summary,
    });

    if (!parsed.success) {
      const titleIssue = parsed.error.issues.some((issue) =>
        issue.path.includes("title")
      );
      setError(
        titleIssue
          ? title.trim()
            ? "Keep the title to 50 characters or fewer."
            : "Add a title for the guide you want to see."
          : "Keep the summary to 500 characters or fewer."
      );
      setStatus("error");
      return;
    }

    setError(null);
    setStatus("submitting");

    try {
      await createTodo(parsed.data);
      setStatus("success");
      toast.success("Guide request submitted");
      onSubmitted?.();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not submit the guide request. Try again.";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <Stepper.Content step="guide-request-details">
      <StepperActionHeader
        title="Guide Request Details"
        Stepper={Stepper}
        type="guide-request"
        hideGuidelines
        onPublish={submitRequest}
        publishLabel="Submit Request"
        confirmBeforePublish={false}
        submitting={status === "submitting" || status === "success"}
      />

      <FieldGroup>
        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel
              required
              htmlFor="guide-request-title"
              className="font-mono text-[14px] tracking-[0.08em] uppercase"
            >
              Title
            </FieldLabel>

            <FieldDescription className="text-xs">
              A clear, concise name for the guide you want someone to write.
            </FieldDescription>
          </div>

          <Input
            id="guide-request-title"
            type="text"
            autoComplete="off"
            maxLength={50}
            placeholder="Choose a title. (Maximum 50 characters)."
            className="h-10 rounded-md"
            required
            value={title}
            aria-invalid={status === "error" && !title.trim()}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) {
                setError(null);
                setStatus("idle");
              }
            }}
          />
        </Field>

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel
              htmlFor="guide-request-summary"
              className="font-mono text-[14px] tracking-[0.08em] uppercase"
            >
              Summary
            </FieldLabel>

            <FieldDescription className="text-xs">
              Briefly describe what you would like the guide to explain.
            </FieldDescription>
          </div>

          <Textarea
            id="guide-request-summary"
            rows={4}
            maxLength={500}
            placeholder="Write a summary for the guide request."
            className="h-32 w-full min-w-0 resize-none"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </Field>

        {error && <FieldError>{error}</FieldError>}

        {status === "success" && (
          <p className="text-sm text-muted-foreground" role="status">
            Your guide request was submitted.
          </p>
        )}
      </FieldGroup>
    </Stepper.Content>
  );
};
