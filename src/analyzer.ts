import { SQSEvent, SQSHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';

const cloudwatch = new AWS.CloudWatch();

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('Analyzer triggered by SQS event');

  try {
    // Query CloudWatch for recent metrics
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // Last 5 minutes

    const metricDataQueries = [
      {
        Id: 'invocations',
        MetricStat: {
          Metric: {
            Namespace: 'LambdaPractice',
            MetricName: 'InvocationCount',
          },
          Period: 60,
          Stat: 'Sum',
        },
      },
      {
        Id: 'errors',
        MetricStat: {
          Metric: {
            Namespace: 'LambdaPractice',
            MetricName: 'ErrorCount',
          },
          Period: 60,
          Stat: 'Sum',
        },
      },
      {
        Id: 'latency',
        MetricStat: {
          Metric: {
            Namespace: 'LambdaPractice',
            MetricName: 'Latency',
          },
          Period: 60,
          Stat: 'Average',
        },
      },
    ];

    const response = await cloudwatch.getMetricData({
      MetricDataQueries: metricDataQueries,
      StartTime: startTime,
      EndTime: endTime,
    }).promise();

    // Analyze the data
    const invocations = response.MetricDataResults?.find(m => m.Id === 'invocations')?.Values?.[0] || 0;
    const errors = response.MetricDataResults?.find(m => m.Id === 'errors')?.Values?.[0] || 0;
    const avgLatency = response.MetricDataResults?.find(m => m.Id === 'latency')?.Values?.[0] || 0;

    const errorRate = invocations > 0 ? (errors / invocations) * 100 : 0;

    console.log(`Analysis: Invocations: ${invocations}, Errors: ${errors}, Error Rate: ${errorRate}%, Avg Latency: ${avgLatency}ms`);

    // Simple RCA logic
    let rca = 'System operating normally.';
    if (errorRate > 10) {
      rca = 'High error rate detected. Possible causes: API throttling, code bugs, or resource limits.';
    }
    if (avgLatency > 1500) {
      rca = 'High latency detected. Possible causes: Cold starts, network issues, or overloaded resources.';
    }
    if (errorRate > 10 && avgLatency > 1500) {
      rca = 'Multiple issues: High errors and latency. Likely throttling or capacity problems.';
    }

    // Mock AI analysis (in real scenario, call OpenAI API)
    const aiAnalysis = `AI RCA: Based on metrics, ${rca} Recommended actions: Monitor closely, scale if needed.`;

    console.log(`RCA Result: ${aiAnalysis}`);

    // In a real scenario, send alert or store in DB

  } catch (error) {
    console.error(`Error in analyzer: ${(error as Error).message}`);
  }
};
