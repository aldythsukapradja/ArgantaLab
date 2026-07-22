"""Soul ID workflow graphs 00-05 as ComfyUI API-format JSON, built
programmatically so the media-gen MCP (and any script) can drive them with
parameters instead of hand-edited JSON. Handoff §11.

Every builder returns a dict ready for POST /prompt {"prompt": graph}.
8GB VRAM rules: batch 1, SD1.5-native resolutions, one ControlNet at a time.
"""

CKPT = "v1-5-pruned-emaonly.safetensors"
NEG_DEFAULT = (
    "different person, inconsistent identity, duplicate person, asymmetrical eyes, "
    "deformed face, malformed anatomy, extra fingers, fused fingers, waxy skin, "
    "plastic skin, CGI, 3D render, illustration, cartoon, oversmoothed face, "
    "heavy beauty filter, watermark, text, logo, low resolution, motion blur"
)
# SD1.5-friendly portrait/half-body/full-body resolutions (§5)
RES = {"portrait": (512, 768), "half": (512, 768), "full": (512, 896), "square": (512, 512), "wide": (768, 512)}


def _base(prompt, negative, width, height, seed, steps=28, cfg=7.0,
          sampler="dpmpp_2m", scheduler="karras", prefix="soul"):
    """Shared spine: ckpt -> clip encode -> ksampler -> vae -> save."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": sampler,
            "scheduler": scheduler, "denoise": 1.0,
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0]}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["6", 0]}},
    }


def wf00_base(prompt, seed, res="portrait", negative=NEG_DEFAULT):
    """00 — checkpoint benchmark, no identity conditioning."""
    w, h = RES[res]
    return _base(prompt, negative, w, h, seed, prefix="soul00-base")


def wf01_lora(prompt, seed, lora_name, lora_model=0.8, lora_clip=0.8,
              res="portrait", negative=NEG_DEFAULT):
    """01 — LoRA only: what did the training independently learn."""
    w, h = RES[res]
    g = _base(prompt, negative, w, h, seed, prefix="soul01-lora")
    g["10"] = {"class_type": "LoraLoader", "inputs": {
        "lora_name": lora_name, "strength_model": lora_model, "strength_clip": lora_clip,
        "model": ["1", 0], "clip": ["1", 1]}}
    g["2"]["inputs"]["clip"] = ["10", 1]
    g["3"]["inputs"]["clip"] = ["10", 1]
    g["5"]["inputs"]["model"] = ["10", 0]
    return g


def _ipadapter(g, ref_image_name, weight, model_src, start=0.0, end=0.9,
               preset="PLUS FACE (portraits)"):
    """Attach IPAdapterUnifiedLoader + IPAdapter to graph; returns patched model node id."""
    g["20"] = {"class_type": "LoadImage", "inputs": {"image": ref_image_name}}
    g["21"] = {"class_type": "IPAdapterUnifiedLoader", "inputs": {
        "preset": preset, "model": model_src}}
    g["22"] = {"class_type": "IPAdapter", "inputs": {
        "weight": weight, "start_at": start, "end_at": end, "weight_type": "standard",
        "model": ["21", 0], "ipadapter": ["21", 1], "image": ["20", 0]}}
    return ["22", 0]


def wf02_ipadapter(prompt, seed, ref_image_name, weight=0.85,
                   res="portrait", negative=NEG_DEFAULT):
    """02 — IP-Adapter only: zero-shot reference identity, no LoRA."""
    w, h = RES[res]
    g = _base(prompt, negative, w, h, seed, prefix="soul02-ipa")
    g["5"]["inputs"]["model"] = _ipadapter(g, ref_image_name, weight, ["1", 0])
    return g


def wf03_lora_ipadapter(prompt, seed, lora_name, ref_image_name,
                        lora_model=0.7, lora_clip=0.7, ipa_weight=0.6,
                        res="portrait", negative=NEG_DEFAULT):
    """03 — PRIMARY Soul ID workflow: LoRA prior + IP-Adapter anchor.
    Both weights moderate — stacking two strong identity systems causes rigidity."""
    g = wf01_lora(prompt, seed, lora_name, lora_model, lora_clip, res, negative)
    g["7"]["inputs"]["filename_prefix"] = "soul03-lora-ipa"
    g["5"]["inputs"]["model"] = _ipadapter(g, ref_image_name, ipa_weight, ["10", 0])
    return g


def wf04_controlnet(prompt, seed, lora_name, ref_image_name, pose_image_name,
                    control="openpose", strength=0.8, res="half", **kw):
    """04 — 03 + ONE ControlNet (openpose|depth) for pose/composition."""
    cn_file = {
        "openpose": "control_v11p_sd15_openpose_fp16.safetensors",
        "depth": "control_v11f1p_sd15_depth_fp16.safetensors",
    }[control]
    g = wf03_lora_ipadapter(prompt, seed, lora_name, ref_image_name, res=res, **kw)
    g["7"]["inputs"]["filename_prefix"] = f"soul04-cn-{control}"
    g["30"] = {"class_type": "LoadImage", "inputs": {"image": pose_image_name}}
    g["31"] = {"class_type": "ControlNetLoader", "inputs": {"control_net_name": cn_file}}
    g["32"] = {"class_type": "ControlNetApplyAdvanced", "inputs": {
        "strength": strength, "start_percent": 0.0, "end_percent": 1.0,
        "positive": ["2", 0], "negative": ["3", 0], "control_net": ["31", 0],
        "image": ["30", 0], "vae": ["1", 2]}}
    g["5"]["inputs"]["positive"] = ["32", 0]
    g["5"]["inputs"]["negative"] = ["32", 1]
    return g


def wf05_face_refine(image_name, prompt, seed, denoise=0.35, upscale_by=2.0):
    """05 — FaceDetailer repair + RealESRGAN upscale on an existing image.
    Low denoise: refine the face, never replace the person."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG_DEFAULT, "clip": ["1", 1]}},
        "10": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "11": {"class_type": "UltralyticsDetectorProvider", "inputs": {"model_name": "bbox/face_yolov8m.pt"}},
        "12": {"class_type": "FaceDetailer", "inputs": {
            "image": ["10", 0], "model": ["1", 0], "clip": ["1", 1], "vae": ["1", 2],
            "positive": ["2", 0], "negative": ["3", 0], "bbox_detector": ["11", 0],
            "guide_size": 384, "guide_size_for": True, "max_size": 768,
            "seed": seed, "steps": 20, "cfg": 7.0, "sampler_name": "dpmpp_2m",
            "scheduler": "karras", "denoise": denoise, "feather": 5,
            "noise_mask": True, "force_inpaint": True,
            "bbox_threshold": 0.5, "bbox_dilation": 10, "bbox_crop_factor": 3.0,
            "sam_detection_hint": "center-1", "sam_dilation": 0, "sam_threshold": 0.93,
            "sam_bbox_expansion": 0, "sam_mask_hint_threshold": 0.7,
            "sam_mask_hint_use_negative": "False", "drop_size": 10, "wildcard": "",
            "cycle": 1}},
        "13": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": "RealESRGAN_x4plus.pth"}},
        "14": {"class_type": "ImageUpscaleWithModel", "inputs": {"upscale_model": ["13", 0], "image": ["12", 0]}},
        "15": {"class_type": "ImageScaleBy", "inputs": {"upscale_method": "lanczos", "scale_by": upscale_by / 4.0, "image": ["14", 0]}},
        "16": {"class_type": "SaveImage", "inputs": {"filename_prefix": "soul05-refined", "images": ["15", 0]}},
    }
