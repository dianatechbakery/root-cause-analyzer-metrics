import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";

const cloudwatch = new CloudWatchClient({});
const logs = new CloudWatchLogsClient({});
const sqs = new SQSClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    // Simulate processing with random delay and potential error
    const delay = Math.random() * 2000; // 0-2 seconds
    await new Promise(resolve => setTimeout(resolve, delay));

    const shouldError = Math.random() < 0.2; // 20% chance of error
    if (shouldError) {
      throw new Error('Simulated processing error');
    }

    const latency = Date.now() - startTime;

    // Emit metrics to CloudWatch
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'LambdaPractice',
      MetricData: [
        {
          MetricName: 'InvocationCount',
          Value: 1,
          Unit: 'Count',
          Timestamp: new Date(),
        },
        {
          MetricName: 'Latency',
          Value: latency,
          Unit: 'Milliseconds',
          Timestamp: new Date(),
        },
      ],
    }));

    // Log success
    console.log(`Processed request successfully in ${latency}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Metrics collected',
        latency,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    // Emit error metrics
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'LambdaPractice',
      MetricData: [
        {
          MetricName: 'ErrorCount',
          Value: 1,
          Unit: 'Count',
          Timestamp: new Date(),
        },
        {
          MetricName: 'Latency',
          Value: latency,
          Unit: 'Milliseconds',
          Timestamp: new Date(),
        },
      ],
    }));

    // Send message to SQS for analysis
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.QUEUE_URL!,
      MessageBody: JSON.stringify({
        type: 'error',
        message: (error as Error).message,
        latency,
        timestamp: new Date().toISOString(),
      }),
    }));

    // Log error
    console.error(`Error processing request: ${(error as Error).message}, latency: ${latency}ms`);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error collecting metrics',
        error: (error as Error).message,
        latency,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
