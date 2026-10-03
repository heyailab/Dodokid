/** 内容动作区 — 按状态×角色矩阵渲染唯一主按钮（§3.4(d)），含驳回原因弹窗。 */
import { ClockCounterClockwise, Eye, PaperPlaneTilt } from '@phosphor-icons/react';
import { Input, Modal, Tooltip } from 'antd';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { Button, Can, useToast } from '../../shared/components';
import type { AdminContent, ContentStatus } from '../../types/api';

export interface ActionBarProps {
  status: ContentStatus;
  isEdit: boolean;
  dirty: boolean;
  isAdmin: boolean;
  saving: boolean;
  transitioning: boolean;
  item: AdminContent | undefined;
  onOpenRevisions: () => void;
  onPreview: () => void;
  onSave: () => void;
  onSubmit: () => void;
  /** v1.2.0 publish：draft → published（admin-only），走确认弹窗 */
  onPublish: () => void;
  /** v1.2.0 withdraw：in_review → draft（editor+），走确认弹窗 */
  onWithdraw: () => void;
  onApprove: () => void;
  onUnpublish: () => void;
}

/**
 * 按 §3.4(d) 状态×角色矩阵计算可见动作（v1.2.0 起 9 条状态转移与后端一致）：
 * publish（draft+admin）/ withdraw（in_review+editor+）/ approve / reject / unpublish。
 * duplicate 在列表页行操作提供，不在编辑页动作区。
 */
export function actionVisibility(status: ContentStatus, isAdmin: boolean) {
  return {
    save: status !== 'in_review',
    submit: status === 'draft' && !isAdmin,
    publish: status === 'draft' && isAdmin,
    withdraw: status === 'in_review',
    approve: status === 'in_review' && isAdmin,
    reject: status === 'in_review' && isAdmin,
    unpublish: status === 'published' && isAdmin,
  };
}

export function ContentActionBar(props: ActionBarProps) {
  const { status, isEdit, dirty, saving, transitioning, item } = props;
  const show = actionVisibility(status, props.isAdmin);
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button variant="secondary" icon={<ClockCounterClockwise size={16} />} onClick={props.onOpenRevisions}>
        版本历史
      </Button>
      <Button variant="secondary" icon={<Eye size={16} />} onClick={props.onPreview}>
        预览
      </Button>
      {show.save && (
        <Tooltip title={!dirty && isEdit ? '没有需要保存的更改' : ''}>
          <Button loading={saving} loadingText="保存中…" disabled={Boolean(isEdit) && !dirty} onClick={props.onSave}>
            {status === 'archived' ? '保存并恢复为草稿' : '保存草稿'}
          </Button>
        </Tooltip>
      )}
      {show.submit && (
        <Button icon={<PaperPlaneTilt size={16} />} loading={transitioning} disabled={dirty} onClick={props.onSubmit}>
          提交审核
        </Button>
      )}
      {show.publish && (
        <Button loading={transitioning} disabled={dirty} onClick={props.onPublish}>
          直接发布
        </Button>
      )}
      {show.withdraw && (
        <Button variant="secondary" loading={transitioning} onClick={props.onWithdraw}>
          撤回
        </Button>
      )}
      {show.approve && (
        <Button loading={transitioning} onClick={props.onApprove}>
          审核通过
        </Button>
      )}
      {show.reject && (
        <Button variant="secondary" onClick={() => setRejectOpen(true)}>驳回</Button>
      )}
      {show.unpublish && (
        <Can perm="content.lifecycle">
          <Button variant="danger" onClick={props.onUnpublish}>
            下架
          </Button>
        </Can>
      )}
      {item && (
        <RejectModal
          open={rejectOpen}
          item={item}
          onClose={() => setRejectOpen(false)}
        />
      )}
    </div>
  );
}

function RejectModal({ open, item, onClose }: { open: boolean; item: AdminContent; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const toast = useToast();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  const reject = async () => {
    setPending(true);
    try {
      await adminApi.rejectContent(item._id, reason.trim());
      toast.success('已驳回 · 回到草稿');
      void qc.invalidateQueries({ queryKey: ['admin-content', item._id] });
      void qc.invalidateQueries({ queryKey: ['admin-contents'] });
      void qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setReason('');
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      title="驳回原因（将写入版本记录）"
      okText="驳回"
      confirmLoading={pending}
      okButtonProps={{ danger: true, disabled: reason.trim().length === 0 }}
      onOk={() => void reject()}
      onCancel={onClose}
    >
      <Input.TextArea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="请说明需要修改的问题"
        maxLength={500}
      />
    </Modal>
  );
}
