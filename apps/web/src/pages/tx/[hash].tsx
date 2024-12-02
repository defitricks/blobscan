import type { FC } from "react";
import { useMemo } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";

import type { OptimismDecodedData } from "@blobscan/api/src/blob-parse/optimism";
import type dayjs from "@blobscan/dayjs";

import { RollupBadge } from "~/components/Badges/RollupBadge";
import { Card } from "~/components/Cards/Card";
import { BlobCard } from "~/components/Cards/SurfaceCards/BlobCard";
import { CopyToClipboard } from "~/components/CopyToClipboard";
import { Copyable } from "~/components/Copyable";
import { StandardEtherUnitDisplay } from "~/components/Displays/StandardEtherUnitDisplay";
import { InfoGrid } from "~/components/InfoGrid";
import { DetailsLayout } from "~/components/Layouts/DetailsLayout";
import type { DetailsLayoutProps } from "~/components/Layouts/DetailsLayout";
import { Link } from "~/components/Link";
import { NavArrows } from "~/components/NavArrows";
import { BlockStatus } from "~/components/Status";
import { api } from "~/api-client";
import Loading from "~/icons/loading.svg";
import NextError from "~/pages/_error";
import type { TransactionWithExpandedBlockAndBlob } from "~/types";
import {
  buildAddressRoute,
  buildBlockRoute,
  buildTransactionExternalUrl,
  formatTimestamp,
  formatBytes,
  formatNumber,
  performDiv,
  deserializeFullTransaction,
} from "~/utils";

const Tx: NextPage = () => {
  const router = useRouter();
  const hash = (router.query.hash as string | undefined) ?? "";

  const {
    data: rawTxData,
    error,
    isLoading,
  } = api.tx.getByHash.useQuery<TransactionWithExpandedBlockAndBlob>(
    { hash, expand: "block,blob" },
    { enabled: router.isReady }
  );
  const tx = useMemo(() => {
    if (!rawTxData) {
      return;
    }

    return deserializeFullTransaction(rawTxData);
  }, [rawTxData]);

  const { data: neighbors } = api.tx.getTxNeighbors.useQuery(
    tx
      ? {
          senderAddress: tx.from,
          blockNumber: tx.blockNumber,
          index: tx.index,
        }
      : {
          senderAddress: "",
          blockNumber: 0,
          index: 0,
        },
    {
      enabled: Boolean(tx),
    }
  );

  if (error) {
    return (
      <NextError
        title={error.message}
        statusCode={error.data?.httpStatus ?? 500}
      />
    );
  }

  if (!isLoading && !tx) {
    return <div>Transaction not found</div>;
  }

  let detailsFields: DetailsLayoutProps["fields"] | undefined;

  if (tx) {
    detailsFields = [];

    const {
      blobAsCalldataGasUsed,
      blobs,
      block,
      hash,
      blockNumber,
      blockTimestamp,
      from,
      to,
      rollup,
      blobGasUsed,
      blobGasBaseFee,
      blobGasMaxFee,
      blobAsCalldataGasFee,
    } = tx;

    detailsFields = [
      {
        name: "Hash",
        value: <Copyable value={hash} tooltipText="Copy Hash" />,
      },
      { name: "Status", value: <BlockStatus blockNumber={blockNumber} /> },
      {
        name: "Block",
        value: <Link href={buildBlockRoute(blockNumber)}>{blockNumber}</Link>,
      },
      {
        name: "Timestamp",
        value: (
          <div className="whitespace-break-spaces">
            {formatTimestamp(blockTimestamp)}
          </div>
        ),
      },
      {
        name: "Position In Block",
        value: tx.index,
      },
      {
        name: "From",
        value: (
          <Copyable value={from} tooltipText="Copy from address">
            <Link href={buildAddressRoute(from)}>{from}</Link>
          </Copyable>
        ),
      },
      {
        name: "To",
        value: (
          <Copyable value={to} tooltipText="Copy to address">
            <Link href={buildAddressRoute(to)}>{to}</Link>
          </Copyable>
        ),
      },
    ];

    if (rollup) {
      detailsFields.push({
        name: "Rollup",
        value: <RollupBadge rollup={rollup} />,
      });
    }

    const totalBlobSize = blobs.reduce((acc, b) => acc + b.size, 0);

    detailsFields.push(
      {
        name: "Total Blob Size",
        value: formatBytes(totalBlobSize),
      },
      {
        name: "Blob Gas Price",
        value: <StandardEtherUnitDisplay amount={block.blobGasPrice} />,
      },
      {
        name: "Blob Fee",
        value: (
          <div className="flex flex-col gap-4">
            {blobGasBaseFee ? (
              <div className="flex gap-1">
                <div className="mr-1 text-contentSecondary-light dark:text-contentSecondary-dark">
                  Base:
                </div>
                <StandardEtherUnitDisplay amount={blobGasBaseFee} />
              </div>
            ) : null}
            <div className=" flex gap-1">
              <div className="mr-1 text-contentSecondary-light dark:text-contentSecondary-dark">
                Max:
              </div>
              <StandardEtherUnitDisplay amount={blobGasMaxFee} />
            </div>
          </div>
        ),
      },
      {
        name: "Blob Gas Used",
        value: formatNumber(blobGasUsed),
      },
      {
        name: "Blob As Calldata Gas Used",
        value: (
          <div>
            {formatNumber(blobAsCalldataGasUsed)}{" "}
            <span className="text-contentTertiary-light dark:text-contentTertiary-dark">
              |{" "}
              <strong>
                {formatNumber(
                  performDiv(blobAsCalldataGasUsed, blobGasUsed),
                  "compact",
                  {
                    maximumFractionDigits: 2,
                  }
                )}
              </strong>{" "}
              times larger
            </span>
          </div>
        ),
      },
      {
        name: "Blob As Calldata Gas Fee",
        value: (
          <div className="display flex gap-1">
            {<StandardEtherUnitDisplay amount={blobAsCalldataGasFee} />}
            <span className="text-contentTertiary-light dark:text-contentTertiary-dark">
              |{" "}
              <strong>
                {formatNumber(
                  performDiv(blobAsCalldataGasFee, blobGasBaseFee),
                  "compact",
                  {
                    maximumFractionDigits: 2,
                  }
                )}
              </strong>{" "}
              times more expensive
            </span>
          </div>
        ),
      }
    );
  }

  const decodedData =
    rawTxData?.decodedFields?.type === "optimism"
      ? rawTxData.decodedFields.payload
      : undefined;

  return (
    <>
      <DetailsLayout
        header={
          <div className="flex items-center justify-start gap-4">
            Transaction Details
            <NavArrows
              prev={{
                href: neighbors?.prev ? `/tx/${neighbors.prev}` : undefined,
                tooltip: "Previous transaction from this sender",
              }}
              next={{
                href: neighbors?.next ? `/tx/${neighbors.next}` : undefined,
                tooltip: "Next transaction from this sender",
              }}
            />
          </div>
        }
        externalLink={tx ? buildTransactionExternalUrl(tx.hash) : undefined}
        fields={detailsFields}
      />

      {decodedData && (
        <OptimismCard
          decodedData={decodedData}
          txTimestamp={tx ? tx.blockTimestamp : undefined}
        />
      )}

      <Card header={`Blobs ${tx ? `(${tx.blobs.length})` : ""}`}>
        <div className="space-y-6">
          {isLoading || !tx || !tx.blobs
            ? Array.from({ length: 2 }).map((_, i) => <BlobCard key={i} />)
            : tx.blobs.map((b) => <BlobCard key={b.versionedHash} blob={b} />)}
        </div>
      </Card>
    </>
  );
};

type OptimismCardProps = {
  decodedData: OptimismDecodedData;
  txTimestamp: dayjs.Dayjs | undefined;
};

const OptimismCard: FC<OptimismCardProps> = ({ decodedData, txTimestamp }) => {
  const { data: blockExists, isLoading } = api.block.checkBlockExists.useQuery({
    blockNumber: decodedData.lastL1OriginNumber,
  });

  const blockLink = blockExists
    ? `https://blobscan.com/block/${decodedData.lastL1OriginNumber}`
    : `https://etherscan.io/block/${decodedData.lastL1OriginNumber}`;

  const hash = `0x${decodedData.l1OriginBlockHash}...`;

  const timestamp = txTimestamp
    ? formatTimestamp(
        txTimestamp.subtract(decodedData.timestampSinceL2Genesis, "ms")
      )
    : undefined;

  if (isLoading) {
    return (
      <Card header="Loading Decoded Fields...">
        <div className="flex h-32 items-center justify-center">
          <Loading className="h-8 w-8 animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card header="Decoded Fields">
      <div>
        <InfoGrid
          fields={[
            {
              name: "Timestamp since L2 genesis",
              value: <div className="whitespace-break-spaces">{timestamp}</div>,
            },
            {
              name: "Last L1 origin number",
              value: (
                <div className="flex items-center gap-2">
                  <Link href={blockLink}>{decodedData.lastL1OriginNumber}</Link>
                  <CopyToClipboard
                    value={decodedData.lastL1OriginNumber.toString()}
                    tooltipText="Copy Last L1 origin number"
                  />
                </div>
              ),
            },
            {
              name: "Parent L2 block hash",
              value: "0x" + decodedData.parentL2BlockHash + "...",
            },
            {
              name: "L1 origin block hash",
              value: (
                <div className="flex items-center gap-2">
                  <Link href={blockLink}>{hash}</Link>
                  <CopyToClipboard
                    value={hash}
                    tooltipText="Copy L1 origin block hash"
                  />
                </div>
              ),
            },
            {
              name: "Number of L2 blocks",
              value: decodedData.numberOfL2Blocks,
            },
            {
              name: "Changed by L1 origin",
              value: decodedData.changedByL1Origin,
            },
            {
              name: "Total transactions",
              value: decodedData.totalTxs,
            },
            {
              name: "Contract creation transactions",
              value: decodedData.contractCreationTxsNumber,
            },
          ]}
        />
      </div>
    </Card>
  );
};

export default Tx;
